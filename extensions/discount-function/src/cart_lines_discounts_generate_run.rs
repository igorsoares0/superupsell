use super::schema;
use schema::cart_lines_discounts_generate_run::input::cart::lines::Merchandise;
use shopify_function::prelude::*;
use shopify_function::Result;
use serde::Deserialize;
use std::collections::HashMap;

/// Consolidated config: one entry per product, each with its own discount.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConsolidatedConfiguration {
    entries: Vec<DiscountEntry>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiscountEntry {
    product_id: String,
    percentage: f64,
    discount_label: String,
}

/// Legacy single-offer config (backward compat with existing discount nodes).
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyConfiguration {
    percentage: f64,
    discount_label: String,
    product_ids: Vec<String>,
}

#[shopify_function]
fn cart_lines_discounts_generate_run(
    input: schema::cart_lines_discounts_generate_run::Input,
) -> Result<schema::CartLinesDiscountsGenerateRunResult> {
    let no_discount = Ok(schema::CartLinesDiscountsGenerateRunResult {
        operations: vec![],
    });

    // Only apply product-class discounts
    let has_product_class = input
        .discount()
        .discount_classes()
        .contains(&schema::DiscountClass::Product);
    if !has_product_class {
        return no_discount;
    }

    // Read configuration from the discount node metafield
    let metafield = match input.discount().metafield() {
        Some(m) => m,
        None => return no_discount,
    };

    // Parse config: try new consolidated format first, then legacy
    let entries: Vec<DiscountEntry> =
        if let Ok(cfg) = serde_json::from_str::<ConsolidatedConfiguration>(metafield.value()) {
            cfg.entries
        } else if let Ok(legacy) = serde_json::from_str::<LegacyConfiguration>(metafield.value()) {
            legacy.product_ids.into_iter().map(|id| DiscountEntry {
                product_id: id,
                percentage: legacy.percentage,
                discount_label: legacy.discount_label.clone(),
            }).collect()
        } else {
            return no_discount;
        };

    if entries.is_empty() {
        return no_discount;
    }

    // Build a map from product GID → discount settings
    let product_map: HashMap<&str, &DiscountEntry> = entries
        .iter()
        .map(|e| (e.product_id.as_str(), e))
        .collect();

    // For each cart line, look up the product and create a discount candidate
    let candidates: Vec<schema::ProductDiscountCandidate> = input
        .cart()
        .lines()
        .iter()
        .filter_map(|line| {
            if let Merchandise::ProductVariant(variant) = line.merchandise() {
                let product_gid = variant.product().id().to_string();
                if let Some(entry) = product_map.get(product_gid.as_str()) {
                    if entry.percentage <= 0.0 {
                        return None;
                    }
                    return Some(schema::ProductDiscountCandidate {
                        targets: vec![
                            schema::ProductDiscountCandidateTarget::CartLine(
                                schema::CartLineTarget {
                                    id: line.id().clone(),
                                    quantity: None,
                                },
                            ),
                        ],
                        message: Some(entry.discount_label.clone()),
                        value: schema::ProductDiscountCandidateValue::Percentage(
                            schema::Percentage {
                                value: Decimal(entry.percentage),
                            },
                        ),
                        associated_discount_code: None,
                    });
                }
            }
            None
        })
        .collect();

    if candidates.is_empty() {
        return no_discount;
    }

    Ok(schema::CartLinesDiscountsGenerateRunResult {
        operations: vec![schema::CartOperation::ProductDiscountsAdd(
            schema::ProductDiscountsAddOperation {
                selection_strategy: schema::ProductDiscountSelectionStrategy::All,
                candidates,
            },
        )],
    })
}

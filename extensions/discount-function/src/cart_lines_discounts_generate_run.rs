use super::schema;
use schema::cart_lines_discounts_generate_run::input::cart::lines::Merchandise;
use shopify_function::prelude::*;
use shopify_function::Result;
use serde::Deserialize;

/// Configuration stored in the discount node's metafield.
/// Written by the app server when an offer is created/updated.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Configuration {
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

    let config: Configuration = match serde_json::from_str(metafield.value()) {
        Ok(c) => c,
        Err(_) => return no_discount,
    };

    if config.percentage <= 0.0 || config.product_ids.is_empty() {
        return no_discount;
    }

    // Find cart lines whose product matches the offer's upsell products
    let targets: Vec<schema::ProductDiscountCandidateTarget> = input
        .cart()
        .lines()
        .iter()
        .filter_map(|line| {
            if let Merchandise::ProductVariant(variant) = line.merchandise()
            {
                let product_gid = variant.product().id().to_string();
                if config.product_ids.iter().any(|id| *id == product_gid) {
                    return Some(schema::ProductDiscountCandidateTarget::CartLine(
                        schema::CartLineTarget {
                            id: line.id().clone(),
                            quantity: None,
                        },
                    ));
                }
            }
            None
        })
        .collect();

    if targets.is_empty() {
        return no_discount;
    }

    // One candidate per cart line so Shopify shows the correct label on each
    // line instead of grouping them as a single "BUNDLE DISCOUNT".
    let candidates: Vec<schema::ProductDiscountCandidate> = targets
        .into_iter()
        .map(|target| schema::ProductDiscountCandidate {
            targets: vec![target],
            message: Some(config.discount_label.clone()),
            value: schema::ProductDiscountCandidateValue::Percentage(
                schema::Percentage {
                    value: Decimal(config.percentage),
                },
            ),
            associated_discount_code: None,
        })
        .collect();

    Ok(schema::CartLinesDiscountsGenerateRunResult {
        operations: vec![schema::CartOperation::ProductDiscountsAdd(
            schema::ProductDiscountsAddOperation {
                selection_strategy: schema::ProductDiscountSelectionStrategy::All,
                candidates,
            },
        )],
    })
}

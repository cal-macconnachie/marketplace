import { unmarshall } from "@aws-sdk/util-dynamodb"
import { DynamoDBStreamEvent } from "aws-lambda"
import { PurchasedProduct } from "./products"
import { update } from "../helpers/dynamo-helpers/update"
import { User } from "./users"
import { clearOrganizationProducts } from "../helpers/organizations/clear-organization-products"
import { allocateOrganizationProducts } from "../helpers/organizations/allocate-organization-products"
import isEqual from "lodash.isequal"
import { setInGoodStanding } from "../helpers/organizations/set-in-good-standing"

export interface Organization {
  id: string
  name?: string
  phone?: string
  email?: string
  address?: {
    line_1: string
    line_2?: string
    state: string
    city: string
    country: string
    postal_code: string
  }
  created_at: string
  updated_at?: string

  // stripe fields
  stripe_subscription_id?: string,
  default_payment_method?: {
    user_id: string
    id: string
  }
  purchased_products?: PurchasedProduct[]

  // auth/ fields
  in_good_standing_until?: number
}

// handles updating the users products
export const organizations = async (event: DynamoDBStreamEvent) => {
  for (const record of event.Records) {
    const oldOrg = record.dynamodb?.OldImage
      ? (unmarshall(record.dynamodb.OldImage as Record<string, any>) as Organization)
      : undefined
    const newOrg = record.dynamodb?.NewImage
      ? (unmarshall(record.dynamodb.NewImage as Record<string, any>) as Organization)
      : undefined
    switch (record.eventName) {
      case "INSERT":
        // handle new organization
        if (newOrg == null) throw new Error("New organization data is missing in the record")
        await allocateOrganizationProducts(newOrg)
        if (newOrg.in_good_standing_until) {
          await setInGoodStanding({
            organizationId: newOrg.id,
            inGoodStandingUntil: newOrg.in_good_standing_until
          })
        }
        break
      case "MODIFY":
        if (newOrg == null || oldOrg == null) throw new Error("organization data is missing in the record")
        // handle updated organization if purchasedProducts is different
        if (!isEqual(newOrg.purchased_products, oldOrg.purchased_products)) {
          await clearOrganizationProducts(oldOrg.purchased_products ?? [])
          await allocateOrganizationProducts(newOrg)
        }
        if (!isEqual(newOrg.in_good_standing_until, oldOrg.in_good_standing_until)) {
          await setInGoodStanding({
            organizationId: newOrg.id,
            inGoodStandingUntil: newOrg.in_good_standing_until
          })
        }
        break
      case "REMOVE":
        // handle removed organization
        if (oldOrg == null) throw new Error("Old organization data is missing in the record")
        await clearOrganizationProducts(oldOrg.purchased_products ?? [])
        break
    }
  }
}

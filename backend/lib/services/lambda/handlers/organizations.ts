import { unmarshall } from "@aws-sdk/util-dynamodb"
import { DynamoDBStreamEvent } from "aws-lambda"
import { Organization } from "@marketplace/types"
import { allocateOrganizationProducts } from "../helpers/organizations/allocate-organization-products"
import isEqual from "lodash.isequal"
import { setInGoodStanding } from "../helpers/organizations/set-in-good-standing"

// handles updating the users products
export const organizations = async (event: DynamoDBStreamEvent) => {
  for (const record of event.Records) {
    const oldOrg = record.dynamodb?.OldImage
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (unmarshall(record.dynamodb.OldImage as Record<string, any>) as Organization)
      : undefined
    const newOrg = record.dynamodb?.NewImage
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        break
    }
  }
}

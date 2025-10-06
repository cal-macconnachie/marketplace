import {
  EventBridgeClient, PutEventsCommand, 
  PutEventsRequestEntry
} from "@aws-sdk/client-eventbridge"
const client = new EventBridgeClient({})
export const putEvents = async ({
  events
}: {
  events: PutEventsRequestEntry[]
}) => {
  const result = await client.send(new PutEventsCommand({
    Entries: events
  }))
  return result
}

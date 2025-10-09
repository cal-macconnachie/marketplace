import { domain } from '@marketplace/constants'
import {
  HostedZone, IHostedZone
} from 'aws-cdk-lib/aws-route53'
import { Construct } from 'constructs'

interface Route53ConstructProps {
  envName?: string
}

export class Route53Construct extends Construct {
  public readonly hostedZones: { [zoneName: string]: IHostedZone } = {}

  constructor(scope: Construct, id: string, props?: Route53ConstructProps) {
    super(scope, id)

    const { envName } = props || {}

    // Determine hosted zone based on environment
    const zoneName = envName === 'dev' ? `dev.${domain}` : domain

    // Always try to lookup existing hosted zone first
    // This prevents creating new zones and having to update nameservers
    // fromLookup will perform the lookup during synthesis
    const hostedZone = HostedZone.fromLookup(this, `hosted-zone-${zoneName.replace(/\./g, '-')}`, {
      domainName: zoneName
    })

    this.hostedZones[zoneName] = hostedZone
  }
}

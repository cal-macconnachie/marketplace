import { Construct } from 'constructs'
import { HostedZone } from 'aws-cdk-lib/aws-route53'

interface Route53ConstructProps {
  envName?: string
}

export class Route53Construct extends Construct {
  public readonly hostedZones: { [zoneName: string]: HostedZone } = {}

  constructor(scope: Construct, id: string, props?: Route53ConstructProps) {
    super(scope, id)

    const { envName } = props || {}

    // Create hosted zone based on environment
    const baseDomain = 'marketplace.csm.codes'
    const zoneName = envName === 'dev' ? `dev.${baseDomain}` : baseDomain

    const hostedZone = new HostedZone(this, `hosted-zone-${zoneName.replace(/\./g, '-')}`, {
      zoneName,
      comment: `Hosted zone for ${zoneName}`
    })

    this.hostedZones[zoneName] = hostedZone
  }
}

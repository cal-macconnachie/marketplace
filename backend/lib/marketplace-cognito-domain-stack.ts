import { domain } from '@marketplace/constants'
import * as cdk from 'aws-cdk-lib'
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'

export interface MarketplaceCognitoDomainStackProps extends cdk.StackProps {
  envName?: string
}

/**
 * Creates the Cognito custom domain and Route53 alias record.
 * Assumes certificates already exist (ARNs published in SSM by Certificates stack)
 * and that the parent domain A record exists (created by Networking stack).
 */
export class MarketplaceCognitoDomainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: MarketplaceCognitoDomainStackProps) {
    super(scope, id, props)

    const envName = props?.envName ?? 'dev'

    // Determine hosted zone and domain names
    const hostedZoneName = envName === 'dev' ? `dev.${domain}` : domain
    const cognitoCustomDomainName = envName === 'dev' ? `auth.dev.${domain}` : `auth.${domain}`

    // Import hosted zone from SSM
    const hostedZoneId = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/route53/${hostedZoneName.replace(/\./g, '-')}`
    )
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId,
      zoneName: hostedZoneName
    })

    // Import user pool ID from SSM and then the User Pool
    const userPoolId = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/cognito/user-pool-id`
    )
    const userPool = cognito.UserPool.fromUserPoolId(this, `ImportedUserPool-${envName}`, userPoolId)

    // Import pre-provisioned Cognito custom domain certificate ARN from SSM
    const cognitoCertArn = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/acm/cognito-domain-cert-arn`
    )
    const importedCognitoCert = certificatemanager.Certificate.fromCertificateArn(
      this,
      `ImportedCognitoCertificate-${envName}`,
      cognitoCertArn
    )

    // Create custom domain for Cognito
    const cognitoDomain = new cognito.UserPoolDomain(this, `CognitoDomain-${envName}`, {
      userPool,
      customDomain: {
        domainName: cognitoCustomDomainName,
        certificate: importedCognitoCert
      }
    })

    // Create A record for custom domain pointing to Cognito CloudFront
    new route53.ARecord(this, `CognitoARecord-${envName}`, {
      zone: hostedZone,
      recordName: cognitoCustomDomainName,
      target: route53.RecordTarget.fromAlias(new route53Targets.UserPoolDomainTarget(cognitoDomain))
    })

    new cdk.CfnOutput(this, 'CognitoCustomDomain', {
      value: cognitoCustomDomainName,
      description: 'Cognito custom domain',
      exportName: `${envName}-cognito-custom-domain`
    })
  }
}


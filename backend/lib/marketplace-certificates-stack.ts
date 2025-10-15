import { domain } from '@marketplace/constants'
import * as cdk from 'aws-cdk-lib'
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'

export interface MarketplaceCertificatesStackProps extends cdk.StackProps {
  envName?: string
}

/**
 * Centralized certificate stack.
 * - Provisions ACM certificates for API Gateway custom domain and Cognito custom domain
 * - Stores certificate ARNs in SSM for consumption by dependent stacks
 *
 * Deploy order:
 * 1) MarketplaceInfrastructure (writes HostedZone IDs)
 * 2) MarketplaceCertificates (creates ACM certs, writes ARNs to SSM)
 * 3) MarketplaceNetworking (reads ARNs from SSM and attaches to resources)
 */
export class MarketplaceCertificatesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: MarketplaceCertificatesStackProps) {
    super(scope, id, props)

    const envName = props?.envName ?? 'dev'

    // Determine zone and domains
    const hostedZoneName = domain
    const apiDomain = `api.${domain}`
    const cognitoCustomDomainName = `auth.${domain}`

    // Import hosted zone from SSM
    const hostedZoneId = ssm.StringParameter.valueFromLookup(
      this,
      `/marketplace/${envName}/route53/${hostedZoneName.replace(/\./g, '-')}`
    )
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId,
      zoneName: hostedZoneName
    })

    // API Gateway custom domain certificate (regional)
    const apiCertificate = new certificatemanager.Certificate(this, `ApiCertificate-${envName}`, {
      domainName: apiDomain,
      validation: certificatemanager.CertificateValidation.fromDns(hostedZone)
    })

    // Cognito custom domain certificate (must be in us-east-1)
    const cognitoCertificate = new certificatemanager.Certificate(this, `CognitoCertificate-${envName}`, {
      domainName: cognitoCustomDomainName,
      validation: certificatemanager.CertificateValidation.fromDns(hostedZone)
    })

    // Store ARNs in SSM for dependent stacks
    new ssm.StringParameter(this, 'ApiDomainCertificateArnParam', {
      parameterName: `/marketplace/${envName}/acm/api-domain-cert-arn`,
      stringValue: apiCertificate.certificateArn,
      description: `ACM certificate ARN for API custom domain (${apiDomain})`
    })

    new ssm.StringParameter(this, 'CognitoDomainCertificateArnParam', {
      parameterName: `/marketplace/${envName}/acm/cognito-domain-cert-arn`,
      stringValue: cognitoCertificate.certificateArn,
      description: `ACM certificate ARN for Cognito custom domain (${cognitoCustomDomainName})`
    })

    // Outputs for visibility
    new cdk.CfnOutput(this, 'ApiDomainCertificateArn', {
      value: apiCertificate.certificateArn,
      description: 'API domain certificate ARN',
      exportName: `${envName}-api-domain-cert-arn`
    })
    new cdk.CfnOutput(this, 'CognitoDomainCertificateArn', {
      value: cognitoCertificate.certificateArn,
      description: 'Cognito domain certificate ARN',
      exportName: `${envName}-cognito-domain-cert-arn`
    })
  }
}


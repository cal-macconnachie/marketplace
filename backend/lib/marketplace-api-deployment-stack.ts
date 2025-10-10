import * as cdk from 'aws-cdk-lib'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as apiGW from 'aws-cdk-lib/aws-apigateway'
import { Construct } from 'constructs'

export interface MarketplaceApiDeploymentStackProps extends cdk.StackProps {
  envName?: string
}

export class MarketplaceApiDeploymentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: MarketplaceApiDeploymentStackProps) {
    super(scope, id, props)

    const envName = props?.envName ?? 'dev'
    const forceRedeploy = this.node.tryGetContext('forceRedeploy')

    // Import RestApi and Stage from SSM
    const restApiId = ssm.StringParameter.valueForStringParameter(
      this,
      `/marketplace/${envName}/api-gateway/rest-api-id`
    )
    const stageName = ssm.StringParameter.valueForStringParameter(
      this,
      `/marketplace/${envName}/api-gateway/stage-name`
    )

    // Create a new Deployment and update the existing stage to point to it
    // Include forceRedeploy in the logical id to ensure a new deployment when forced
    const uniqueSuffix = forceRedeploy ? `${forceRedeploy}` : '0'
    new apiGW.CfnDeployment(this, `ApiDeployment${uniqueSuffix}`, {
      restApiId,
      description: `Redeploy API for ${envName} (force=${uniqueSuffix})`,
      stageName
    })
  }
}


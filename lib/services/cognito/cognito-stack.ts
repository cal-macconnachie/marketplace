import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import {
  aws_cognito as cognito, aws_lambda as lambda 
} from 'aws-cdk-lib'

export interface CognitoStackProps extends cdk.StackProps {
  envName: string
  postAuthTriggerFunction: lambda.Function
}

export class CognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool
  public readonly userPoolClient: cognito.UserPoolClient
  public readonly cognitoDomain: cognito.UserPoolDomain

  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id, props)

    const {
      envName, postAuthTriggerFunction 
    } = props

    this.userPool = new cognito.UserPool(this, `UserPool-${envName}`, {
      userPoolName: `UserPool-${envName}`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true 
      },
      autoVerify: { email: false },
      signInCaseSensitive: false,
      standardAttributes: {
        email: {
          required: true, mutable: false 
        } 
      },
      lambdaTriggers: postAuthTriggerFunction ? {
        postAuthentication: postAuthTriggerFunction,
        preSignUp: new lambda.Function(this, `PreSignUpTrigger-${envName}`, {
          runtime: lambda.Runtime.NODEJS_18_X,
          handler: 'index.handler',
          code: lambda.Code.fromInline(`
            exports.handler = async (event) => {
              event.response.autoConfirmUser = true;
              event.response.autoVerifyEmail = true;
              return event;
            };
          `)
        })
      } : undefined
    })
    this.userPoolClient = new cognito.UserPoolClient(this, `UserPoolClient-${envName}`, {
      userPool: this.userPool,
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE
        ],
        callbackUrls: envName === 'dev' ? ['http://localhost:5173/auth/callback'] : ['https://marketplace.csm.codes/auth/callback'],
        logoutUrls: ['https://resume.csm.codes'],
      },
      authFlows: {
        userPassword: true, userSrp: true 
      }
    })
    let googleProvider: cdk.aws_cognito.UserPoolIdentityProviderGoogle | undefined
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, `GoogleProvider-${envName}`, {
        userPool: this.userPool,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        scopes: [
          'profile',
          'email',
          'openid'
        ],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
          familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME
        },
      })
      this.userPoolClient.node.addDependency(googleProvider)
    }
    let appleProvider: cdk.aws_cognito.UserPoolIdentityProviderApple | undefined
    if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY) {
      appleProvider = new cognito.UserPoolIdentityProviderApple(this, `AppleProvider-${envName}`, {
        userPool: this.userPool,
        clientId: process.env.APPLE_CLIENT_ID,
        teamId: process.env.APPLE_TEAM_ID,
        keyId: process.env.APPLE_KEY_ID,
        privateKey: process.env.APPLE_PRIVATE_KEY,
        scopes: [
          'name',
          'email'
        ],
        attributeMapping: {
          email: cognito.ProviderAttribute.APPLE_EMAIL,
          givenName: cognito.ProviderAttribute.APPLE_FIRST_NAME,
          familyName: cognito.ProviderAttribute.APPLE_LAST_NAME
        },
      })
      this.userPoolClient.node.addDependency(appleProvider)
    }

    this.cognitoDomain = new cognito.UserPoolDomain(this, `CognitoDomain-${envName}`, {
      userPool: this.userPool,
      cognitoDomain: {
        domainPrefix: `payment-auth-${envName.toLowerCase()}`
      }
    })
  }
}

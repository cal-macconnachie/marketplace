import { domain } from '@marketplace/constants'
import type { CognitoStackProps } from '@marketplace/types'
import * as cdk from 'aws-cdk-lib'
import {
  aws_cognito as cognito, aws_lambda as lambda
} from 'aws-cdk-lib'
import { Construct } from 'constructs'

export class CognitoStack extends Construct {
  public readonly userPool: cognito.UserPool
  public readonly userPoolClient: cognito.UserPoolClient
  public readonly customDomainName?: string

  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id)

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
          required: true, mutable: true
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
    let googleProvider: cdk.aws_cognito.UserPoolIdentityProviderGoogle | undefined
    if (process.env.GOOGLE_CLIENT_ID) {
      // Reference the Google client secret from Secrets Manager
      const googleClientSecretValue = cdk.SecretValue.secretsManager('marketplace/google/client-secret')

      googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, `GoogleProvider-${envName}`, {
        userPool: this.userPool,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecretValue: googleClientSecretValue,
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
    }
    let appleProvider: cdk.aws_cognito.UserPoolIdentityProviderApple | undefined
    // Force recreation of Apple provider by changing the logical ID
    if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID) {
      // Reference the Apple private key from Secrets Manager
      const applePrivateKeyValue = cdk.SecretValue.secretsManager('marketplace/apple/private-key')

      appleProvider = new cognito.UserPoolIdentityProviderApple(this, `AppleProvider-${envName}`, {
        userPool: this.userPool,
        clientId: process.env.APPLE_CLIENT_ID,
        teamId: process.env.APPLE_TEAM_ID,
        keyId: process.env.APPLE_KEY_ID,
        privateKeyValue: applePrivateKeyValue,
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
    }

    this.userPoolClient = new cognito.UserPoolClient(this, `UserPoolClient-${envName}`, {
      userPool: this.userPool,
      generateSecret: false,
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        ...(googleProvider ? [cognito.UserPoolClientIdentityProvider.GOOGLE] : []),
        ...(appleProvider ? [cognito.UserPoolClientIdentityProvider.APPLE] : [])
      ],
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: envName === 'dev' ? [
          'http://localhost:5173/auth/callback',
          `https://${domain}/auth/callback`
        ] : [`https://${domain}/auth/callback`],
        logoutUrls: envName === 'dev' ? [
          'http://localhost:5173',
          'http://localhost:5173/auth',
          `https://${domain}/auth`,
          `https://${domain}`
        ] : [
          `https://${domain}/auth`,
          `https://${domain}`
        ],
      },
      authFlows: {
        userPassword: true, userSrp: true
      }
    })

    if (googleProvider) {
      this.userPoolClient.node.addDependency(googleProvider)
    }
    if (appleProvider) {
      this.userPoolClient.node.addDependency(appleProvider)
    }
  }
}

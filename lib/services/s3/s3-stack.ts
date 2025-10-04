import {
  Bucket,
  BucketEncryption,
  BucketProps,
  BlockPublicAccess,
  HttpMethods,
  StorageClass,
  IBucket
} from 'aws-cdk-lib/aws-s3'
import {
  Stack, StackProps, RemovalPolicy, Duration 
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import {
  S3BucketDefinition, s3Definitions 
} from './s3-bucket-definitions'
interface s3StackProps extends StackProps {
  envName?: string
}
export class S3Stack extends Stack {
  public readonly buckets: { [bucketName: string]: IBucket } = {}
  constructor(scope: Construct, id: string, props?: s3StackProps) {
    super(scope, id, props)
    const {
      envName 
    } = props || {}

    s3Definitions.forEach((def: S3BucketDefinition) => {
      const bucketName = `${envName}-${def.bucketName}`
      let bucket: Bucket | IBucket
      
      const bucketProps: BucketProps = {
        bucketName,
        versioned: def.versioning,
        encryption:
          def.encryption === 'AES256'
            ? BucketEncryption.S3_MANAGED
            : def.encryption === 'aws:kms'
              ? BucketEncryption.KMS_MANAGED
              : undefined,
        lifecycleRules: def.lifecycleRules?.map((rule) => ({
          id: rule.id,
          enabled: rule.enabled,
          prefix: rule.prefix,
          expiration: rule.expirationInDays ? Duration.days(rule.expirationInDays) : undefined,
          transitions: rule.transitions?.map((t) => ({
            storageClass: StorageClass[t.storageClass as keyof typeof StorageClass],
            transitionAfter: Duration.days(t.transitionInDays)
          }))
        })),
        cors: def.corsRules?.map((c) => ({
          allowedMethods: c.allowedMethods.map((m) => HttpMethods[m as keyof typeof HttpMethods]),
          allowedOrigins: c.allowedOrigins,
          allowedHeaders: c.allowedHeaders,
          exposedHeaders: c.exposeHeaders,
          maxAge: c.maxAgeSeconds
        })),
        blockPublicAccess: def.publicAccessBlock
          ? new BlockPublicAccess({
            blockPublicAcls: def.publicAccessBlock.blockPublicAcls ?? true,
            ignorePublicAcls: def.publicAccessBlock.ignorePublicAcls ?? true,
            blockPublicPolicy: def.publicAccessBlock.blockPublicPolicy ?? true,
            restrictPublicBuckets: def.publicAccessBlock.restrictPublicBuckets ?? true
          })
          : undefined,
        websiteIndexDocument: def.websiteHosting?.indexDocument,
        websiteErrorDocument: def.websiteHosting?.errorDocument,
        removalPolicy: RemovalPolicy.DESTROY
      }
      bucket = new Bucket(this, def.bucketName, bucketProps)
      this.buckets[def.bucketName] = bucket
    })
  }
}

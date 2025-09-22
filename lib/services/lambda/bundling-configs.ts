/* eslint-disable @typescript-eslint/no-unused-vars */
import { BundlingOptions } from 'aws-cdk-lib/aws-lambda-nodejs'

/**
 * Bundling configuration for Lambda functions that use Sharp image processing library.
 * Sharp requires platform-specific binaries for Lambda (linux-x64).
 * This configuration ensures the correct Sharp binaries are installed during bundling.
 */
export const sharpBundlingConfig: BundlingOptions = {
  nodeModules: ['sharp'],
  commandHooks: {
    beforeBundling: (inputDir: string, outputDir: string): string[] => [
      // Remove any existing Sharp installation to ensure clean state
      'rm -rf node_modules/sharp'
    ],
    beforeInstall: (inputDir: string, outputDir: string): string[] => [
      // Install Sharp with platform-specific options for Lambda runtime in output directory
      `cd "${outputDir}" && yarn add sharp --ignore-engines`
    ],
    afterBundling: (inputDir: string, outputDir: string): string[] => []
  },
  environment: {
    // Force npm to install platform-specific binaries
    npm_config_platform: 'linux',
    npm_config_arch: 'x64',
    npm_config_target_platform: 'linux',
    npm_config_target_arch: 'x64'
  },
  forceDockerBundling: true // Force Docker to ensure Linux environment
}

/**
 * Creates a bundling configuration for Lambda functions that require native binaries.
 * Combines Sharp configuration with custom HTML bundling if needed.
 */
export function createNativeBundlingConfig(options?: {
  bundleTemplate?: string[]
  additionalNodeModules?: string[]
}): BundlingOptions {
  const baseConfig = { ...sharpBundlingConfig }
  
  if (options?.additionalNodeModules) {
    baseConfig.nodeModules = [
      ...(baseConfig.nodeModules || []),
      ...options.additionalNodeModules
    ]
  }
  
  if (options?.bundleTemplate) {
    const originalAfterBundling = baseConfig.commandHooks?.afterBundling || (() => [])
    baseConfig.commandHooks = {
      beforeBundling: baseConfig.commandHooks?.beforeBundling || (() => []),
      beforeInstall: baseConfig.commandHooks?.beforeInstall || (() => []),
      afterBundling: (inputDir: string, outputDir: string): string[] => {
        const originalCommands = originalAfterBundling(inputDir, outputDir)
        const htmlCommands = options.bundleTemplate!.map(htmlFile =>
          `mkdir -p "${outputDir}/$(dirname ${htmlFile})" 2>/dev/null || true && cp "${inputDir}/lib/services/lambda/templates/${htmlFile}" "${outputDir}/${htmlFile}" 2>/dev/null || true`
        )
        return [
          ...originalCommands,
          ...htmlCommands
        ]
      }
    }
  }
  
  return baseConfig
}

/**
 * Generic bundling configuration for other native dependencies.
 * Can be extended for other packages that require platform-specific binaries.
 */
export function createCustomNativeBundlingConfig(
  nodeModules: string[],
  installCommands?: string[]
): BundlingOptions {
  return {
    nodeModules,
    commandHooks: {
      beforeBundling: (inputDir: string, outputDir: string): string[] => 
        nodeModules.map(module => `rm -rf node_modules/${module}`),
      beforeInstall: (inputDir: string, outputDir: string): string[] => 
        installCommands || nodeModules.map(module => 
          `cd "${outputDir}" && yarn add ${module} --ignore-engines`
        ),
      afterBundling: (inputDir: string, outputDir: string): string[] => []
    },
    environment: {
      npm_config_platform: 'linux',
      npm_config_arch: 'x64',
      npm_config_target_platform: 'linux',
      npm_config_target_arch: 'x64'
    },
    forceDockerBundling: true
  }
}

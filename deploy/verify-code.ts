import fs from 'node:fs/promises'
import { HttpNetworkUserConfig } from 'hardhat/types'
import { task, types } from 'hardhat/config'
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names'

task('verify-code', 'Verify code of a contract')
  .addParam<string>('contractName', 'Contract name', undefined, types.string)
  .addParam<string>('contractAddress', 'Contract address', undefined, types.string)
  .addOptionalParam<string>('folder', 'Contract folder', undefined, types.string)
  .addOptionalParam<string>('lpPair', 'Liquidity pool pair', undefined, types.string)
  .setAction(async ({ contractAddress, contractName, folder, lpPair }, { ethers, run, network }) => {
    await run(TASK_COMPILE, {
      force: true,
      noTypechain: true,
    })

    const networkConfig = network.config as HttpNetworkUserConfig
    console.log(`Network: ${network.name}`)
    console.log(`Chain id: ${networkConfig.chainId}`)
    console.log(`Provider URL: ${networkConfig.url}`)
    console.log(`\nContract name: ${contractName}`)
    console.log(`Contract address: ${contractAddress}`)
    if (lpPair) {
      console.log(`Liquidity pool pair: ${lpPair}`)
    }

    const artifact = await fs.readFile(
      `./artifacts/contracts/${folder ? `${folder}/` : '/'}${contractName}.sol/${contractName}.json`
    )
    const { deployedBytecode: buildCode } = JSON.parse(artifact.toString())

    const chainCode = await ethers.provider.getCode(contractAddress)
    if (buildCode.length != chainCode.length) {
      throw new Error(`Build code size doesn't match chain code size: ${buildCode.length} != ${chainCode.length}`)
    }

    console.log(`\nBuild code matches chain code by ${calculateSimilarityRatio(buildCode, chainCode, 4)}%`)

    await fs.rm('./build', { recursive: true, force: true })
    await fs.mkdir('./build')

    const buildCodeFilePath = `./build/build-code-${contractName}.bin-runtime`
    await fs.writeFile(buildCodeFilePath, buildCode)
    console.log(`Build code saved to ${buildCodeFilePath}`)

    const chainCodeFilePath = `./build/chain-code-${contractName}.bin-runtime`
    await fs.writeFile(chainCodeFilePath, chainCode)
    console.log(`Chain code saved to ${chainCodeFilePath}`)
  })

function calculateSimilarityRatio(buildCode: string, chainCode: string, digits: number): string {
  let matchCount = 0
  for (let i = 0; i < buildCode.length; i++) {
    if (buildCode[i] == chainCode[i]) {
      matchCount++
    }
  }

  const similarityRatio = (matchCount / buildCode.length) * 100
  return similarityRatio.toFixed(digits)
}

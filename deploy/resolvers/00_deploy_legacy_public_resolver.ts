import { ethers, network } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const registry = await ethers.getContract('ENSRegistry')

  if (!network.tags.legacy) {
    return
  }

  const LegacyPublicResolver = await deploy('LegacyPublicResolver', {
    from: deployer,
    args: [registry.address],
    log: true,
    contract: await deployments.getArtifact('PublicResolver_mainnet_9412610'),
  })

  // await hre.run("verify:verify", {
  //   address: LegacyPublicResolver.address,
  //   constructorArguments: [registry.address]
  // })

  return true
}

func.id = 'legacy-resolver'
func.tags = ['resolvers', 'LegacyPublicResolver']
func.dependencies = ['registry', 'wrapper']

export default func

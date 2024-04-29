import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const registry = await ethers.getContract('ENSRegistry')
  const batchGatewayURLs = JSON.parse(process.env.BATCH_GATEWAY_URLS || '[]')

  if (batchGatewayURLs.length === 0) {
    throw new Error('UniversalResolver: No batch gateway URLs provided')
  }

  const UniversalResolver = await deploy('UniversalResolver', {
    from: deployer,
    args: [registry.address, batchGatewayURLs],
    log: true,
  })




  try {

    await hre.run("verify:verify", {
      address: UniversalResolver.address,
      constructorArguments: [registry.address, batchGatewayURLs]
    })
  } catch (error) {
    console.log(error);
  }
}

func.id = 'universal-resolver'
func.tags = ['utils', 'UniversalResolver']
func.dependencies = ['registry']

export default func

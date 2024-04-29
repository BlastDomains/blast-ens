import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  let metadataHost =
    process.env.METADATA_HOST || 'ens-metadata-service.appspot.com'

  if (network.name === 'localhost') {
    metadataHost = 'http://localhost:8080'
  }

  const metadataUrl = `${metadataHost}/name/0x{id}`

  const StaticMetadataService = await deploy('StaticMetadataService', {
    from: deployer,
    args: [metadataUrl],
    log: true,
  })


  try {

    await hre.run("verify:verify", {
      address: StaticMetadataService.address,
      constructorArguments: [metadataUrl]
    })
  } catch (error) {
    console.log(error);
  }
}

func.id = 'metadata'
func.tags = ['wrapper', 'StaticMetadataService']
// technically not a dep, but we want to make sure it's deployed first for the consistent address
func.dependencies = ['BaseRegistrarImplementation']

export default func

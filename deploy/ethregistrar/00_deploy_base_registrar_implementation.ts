import namehash from 'eth-ens-namehash'
import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { keccak256 } from 'js-sha3'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  if (!network.tags.use_root) {
    return true
  }

  const registry = await ethers.getContract('ENSRegistry')

  const deployArgs = {
    from: deployer,
    args: [registry.address, namehash.hash('blast')],
    log: true,
  }

  const bri = await deploy('BaseRegistrarImplementation', deployArgs)
  if (!bri.newlyDeployed) return

  try {
    await hre.run("verify:verify", {
      address: bri.address,
      constructorArguments: [registry.address, namehash.hash('blast')]
    })
  } catch (error) {
    console.log(error);
  }
}

func.id = 'registrar'
func.tags = ['ethregistrar', 'BaseRegistrarImplementation']
func.dependencies = ['registry', 'root']

export default func

import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { deploy } = deployments
  const { deployer, owner } = await getNamedAccounts()

  const registry = await hre.deployments.get('ENSRegistry')
  const dnssec = await hre.deployments.get('DNSSECImpl')
  const resolver = await hre.deployments.get('OffchainDNSResolver')
  const oldregistrar = await hre.deployments.getOrNull('DNSRegistrar')
  const root = await ethers.getContract('Root')

  const publicSuffixList = await deploy('TLDPublicSuffixList', {
    from: deployer,
    args: [],
    log: true,
  })

  const tx = await deploy('DNSRegistrar', {
    from: deployer,
    args: [
      oldregistrar?.address || '0x0000000000000000000000000000000000000000',
      resolver.address,
      dnssec.address,
      publicSuffixList.address,
      registry.address,
    ],
    log: true,
  })
  console.log(`Deployed DNSRegistrar to ${tx.address}`)

  const tx2 = await root
    .connect(await ethers.getSigner(owner))
    .setController(tx.address, true)
  console.log(`Set DNSRegistrar as controller of Root (${tx2.hash})`)
  await tx2.wait()




  try {
    await hre.run("verify:verify", {
      address: tx.address,
      constructorArguments: [oldregistrar?.address || '0x0000000000000000000000000000000000000000',
      resolver.address,
      dnssec.address,
      publicSuffixList.address,
      registry.address]
    })

    await hre.run("verify:verify", {
      address: publicSuffixList.address,
      constructorArguments: []
    })
  } catch (error) {
    console.log(error);
  }
}

func.tags = ['DNSRegistrar']
func.dependencies = [
  'registry',
  'dnssec-oracle',
  'OffchainDNSResolver',
  'Root',
  'setupRoot',
]

export default func

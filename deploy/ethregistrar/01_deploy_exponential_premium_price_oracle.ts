import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  let oracleAddress = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'
  if (network.name !== 'mainnet') {
    const dummyOracle = await deploy('DummyOracle', {
      from: deployer,
      args: ['160000000000'],
      log: true,
    })
    oracleAddress = dummyOracle.address
  }

  const oracle = await deploy('ExponentialPremiumPriceOracle', {
    from: deployer,
    args: [
      oracleAddress,
      [0, 0, '12683916793505', '5073566717402', '405885337392'],
      '100000000000000000000000000',
      21,
    ],
    log: true,
  })

  try {
    await hre.run('verify:verify', {
      address: oracle.address,
      constructorArguments: [
        oracleAddress,
        [0, 0, '12683916793505', '5073566717402', '405885337392'],
        '100000000000000000000000000',
        21,
      ],
    })
  } catch (error) {
    console.log(error)
  }
}

func.id = 'price-oracle'
func.tags = ['ethregistrar', 'ExponentialPremiumPriceOracle', 'DummyOracle']
func.dependencies = ['registry']

export default func

// import { ethers } from 'hardhat'
// import { DeployFunction } from 'hardhat-deploy/types'
// import { HardhatRuntimeEnvironment } from 'hardhat/types'

// async function main(hre: HardhatRuntimeEnvironment) {
//     const { getNamedAccounts, deployments, network } = hre
//     const { deploy } = deployments
//     const LegacyENSRegistry = await ethers.getContract('LegacyENSRegistry');

//     console.log("LegacyENSRegistry", LegacyENSRegistry.address);
// }

// // We recommend this pattern to be able to use async/await everywhere
// // and properly handle errors.
// main('testnet').catch((error) => {
//     console.error(error);
//     process.exitCode = 1;
// });
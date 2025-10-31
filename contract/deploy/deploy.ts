import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedMines = await deploy("Minesweeper", {
    from: deployer,
    log: true,
  });

  console.log(`✅ Minesweeper deployed at: ${deployedMines.address}`);
};

export default func;

func.id = "deploy_Minesweeper"; // avoid running twice
func.tags = ["Minesweeper"];

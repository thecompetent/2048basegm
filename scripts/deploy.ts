import { ethers, network } from "hardhat";

async function main() {
  const signerAddr = process.env.SCORE_SIGNER_ADDRESS;
  if (!signerAddr) throw new Error("Set SCORE_SIGNER_ADDRESS in .env");

  console.log(`Deploying GmManager to ${network.name} with signer ${signerAddr}`);
  const Factory = await ethers.getContractFactory("GmManager");
  const gm = await Factory.deploy(signerAddr);
  await gm.waitForDeployment();
  const addr = await gm.getAddress();
  console.log("GmManager deployed:", addr);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

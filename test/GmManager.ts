import { expect } from "chai";
import { ethers } from "hardhat";

describe("GmManager", function () {
  it("claims, enforces daily, and applies multipliers", async () => {
    const [owner, user, signer] = await ethers.getSigners();
    const Gm = await ethers.getContractFactory("GmManager");
    const gm = await Gm.connect(owner).deploy(signer.address);
    await gm.deployed();

    // helper: sign typed data
    const domain = {
      name: "GmManager",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: gm.address,
    };

    const types = {
      ScoreClaim: [
        { name: "wallet", type: "address" },
        { name: "score", type: "uint256" },
        { name: "validUntil", type: "uint256" },
        { name: "day", type: "uint64" },
      ],
    } as const;

    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const day = Math.floor(now / (24 * 60 * 60));

    const claim = {
      wallet: user.address,
      score: 16000, // 3x score multiplier
      validUntil: now + 3600,
      day,
    };

    const sig = await signer._signTypedData(domain, types as any, claim);

    await expect(gm.connect(user).claimGm(claim, sig)).to.emit(gm, "GmClaimed");
    const total1 = await gm.totalGm(user.address);
    // day1: streak=1, scoreMult=3 => 3 points
    expect(total1).to.equal(3);

    // same day second claim should fail
    await expect(gm.connect(user).claimGm(claim, sig)).to.be.revertedWithCustomError(
      gm,
      "TooManyClaimsToday"
    );

    // fast-forward one day
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    const now2 = (await ethers.provider.getBlock("latest")).timestamp;
    const day2 = Math.floor(now2 / (24 * 60 * 60));

    const claim2 = { ...claim, day: day2, validUntil: now2 + 3600 };
    const sig2 = await signer._signTypedData(domain, types as any, claim2);

    await gm.connect(user).claimGm(claim2, sig2);
    const total2 = await gm.totalGm(user.address);
    // day2: streak=2, scoreMult=3 => +6 points, total 9
    expect(total2).to.equal(9);
  });
});


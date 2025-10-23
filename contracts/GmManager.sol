// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract GmManager is Ownable, EIP712 {
    using ECDSA for bytes32;

    struct ScoreClaim {
        address wallet;
        uint256 score; // raw game score
        uint256 validUntil; // unix timestamp to avoid replay
        uint64 day; // day id (UTC day = timestamp / 1 days)
    }

    bytes32 private constant SCORE_CLAIM_TYPEHASH = keccak256(
        "ScoreClaim(address wallet,uint256 score,uint256 validUntil,uint64 day)"
    );

    address public signer; // backend signer that authorizes score claims

    // user state
    mapping(address => uint256) public totalGm; // accumulated gm points
    mapping(address => uint256) public bestScore; // best game score
    mapping(address => uint64) public lastClaimDay; // last claimed day
    mapping(address => uint64) public streakDays; // current consecutive day streak (>=1 when claimed)

    event GmClaimed(
        address indexed user,
        uint256 score,
        uint8 scoreMultiplier,
        uint64 streakMultiplier,
        uint64 day,
        uint256 pointsAdded,
        uint256 newTotal
    );

    error InvalidSignature();
    error ClaimExpired();
    error TooManyClaimsToday();
    error NotOwnerSigner();

    constructor(address _signer) Ownable(msg.sender) EIP712("GmManager", "1") {
        signer = _signer;
    }

    function setSigner(address _signer) external onlyOwner {
        signer = _signer;
    }

    function getScoreMultiplier(uint256 score) public pure returns (uint8) {
        if (score < 5000) return 0;
        if (score < 10000) return 1;
        if (score < 15000) return 2;
        if (score < 20000) return 3;
        return 4; // 20000+
    }

    function _today() internal view returns (uint64) {
        return uint64(block.timestamp / 1 days);
    }

    function _hashTyped(ScoreClaim memory c) internal view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    SCORE_CLAIM_TYPEHASH,
                    c.wallet,
                    c.score,
                    c.validUntil,
                    c.day
                )
            )
        );
    }

    function verify(ScoreClaim calldata c, bytes calldata sig) public view returns (bool) {
        bytes32 digest = _hashTyped(ScoreClaim(c.wallet, c.score, c.validUntil, c.day));
        address recovered = ECDSA.recover(digest, sig);
        return recovered == signer;
    }

    function claimGm(ScoreClaim calldata c, bytes calldata sig) external {
        if (msg.sender != c.wallet) revert InvalidSignature();
        if (block.timestamp > c.validUntil) revert ClaimExpired();

        uint64 day = _today();
        // bind the signature to the same day
        require(c.day == day, "DAY_MISMATCH");

        if (!verify(c, sig)) revert InvalidSignature();

        // only once per day
        if (lastClaimDay[msg.sender] == day) revert TooManyClaimsToday();

        // streak logic: if claimed yesterday, increment; else reset to 1
        if (lastClaimDay[msg.sender] + 1 == day) {
            unchecked {
                streakDays[msg.sender] = streakDays[msg.sender] + 1;
            }
        } else {
            streakDays[msg.sender] = 1;
        }

        lastClaimDay[msg.sender] = day;

        uint8 scoreMult = getScoreMultiplier(c.score);
        require(scoreMult > 0, "SCORE_TOO_LOW");

        uint64 streakMult = streakDays[msg.sender];

        // points added are multiplicative by requirement
        // pointsAdded = scoreMult * streakMult
        uint256 pointsAdded = uint256(scoreMult) * uint256(streakMult);

        unchecked {
            totalGm[msg.sender] = totalGm[msg.sender] + pointsAdded;
        }

        if (c.score > bestScore[msg.sender]) {
            bestScore[msg.sender] = c.score;
        }

        emit GmClaimed(msg.sender, c.score, scoreMult, streakMult, day, pointsAdded, totalGm[msg.sender]);
    }
}


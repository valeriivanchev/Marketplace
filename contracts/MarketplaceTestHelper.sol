//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./NFTCollection.sol";
import "./MyToken.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

// TODO: Implement all user stories and one of the feature request
contract MarketplaceTestHelper is ERC721Holder {
    Marketplace marketplaceContract;

    constructor(address marketplaceAddress) {
        marketplaceContract = Marketplace(marketplaceAddress);
    }

    function buyFixedPriceNFT(uint256 tokenId, address collectionAddress)
        external
        payable
    {
        marketplaceContract.buyFixedPriceNFT{value: msg.value}(
            tokenId,
            collectionAddress
        );
    }
}

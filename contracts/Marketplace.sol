//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./NFTCollection.sol";

// TODO: Implement all user stories and one of the feature request
contract Marketplace {
    event CollectionCreated(string collectionName, address collectionAddress);
    event TokenMinted(uint256 _tokenId,address owner,address collectionAddress);
    event ListedNFT(uint256 _tokenId,address owner,address collectionAddress,string listType,uint256 price);
    event NFTBought(uint256 _tokenId,address collectionAddress,address newOwner);

    mapping(address => mapping(uint256 => uint256)) prices;

    modifier onlyFromWhiteListedCollection(address collectionAddress){
        require(whiteListedCollections[collectionAddress] == true,"Cannot mint");
        _;
    }

    modifier onlyOwnerOfNFT(address collectionAddress,uint256 tokenId,address owner){
     require(NFTCollection(collectionAddress).ownerOf(tokenId) == owner,"Not the owner");
        _;
    }

    mapping(address => bool) whiteListedCollections;
    function createCollection(string memory description, string memory collectionName, string memory collectionSymbol) public returns(address){
        NFTCollection nftCollection = new NFTCollection(description,collectionName,collectionSymbol);
        address collectionAddress = address(nftCollection);
        whiteListedCollections[collectionAddress] = true;
        emit CollectionCreated(collectionName,collectionAddress);
        return collectionAddress;
    }

    function mintToken(address collectionAddress, string memory ipfsHash) public onlyFromWhiteListedCollection(collectionAddress){
     uint256 tokenId = NFTCollection(collectionAddress).mintToken(msg.sender,ipfsHash);
     emit TokenMinted(tokenId,msg.sender,collectionAddress);
    }

    function listFixedPriceNFT(uint256 price,uint256 tokenId, address collectionAddress)public onlyOwnerOfNFT(collectionAddress,tokenId,msg.sender) onlyFromWhiteListedCollection(collectionAddress){
        require(NFTCollection(collectionAddress).getApproved(tokenId) == address(this),"Not approved");
        prices[collectionAddress][tokenId] = price;
        emit ListedNFT(tokenId,msg.sender,collectionAddress,"fixed",price);
    }

    function buyFixedPriceNFT(uint256 tokenId, address collectionAddress, address owner)public payable onlyFromWhiteListedCollection(collectionAddress){
       NFTCollection nftCollection = NFTCollection(collectionAddress);
       require(msg.value >= prices[collectionAddress][tokenId],"Not enough to buy");
       nftCollection.safeTransferFrom(owner,msg.sender,tokenId);
       payable(owner).transfer(prices[collectionAddress][tokenId]);
       uint256 change = msg.value - prices[collectionAddress][tokenId];
       payable(msg.sender).transfer(change);
       delete prices[collectionAddress][tokenId];
       emit NFTBought(tokenId,collectionAddress,msg.sender);
    }
}

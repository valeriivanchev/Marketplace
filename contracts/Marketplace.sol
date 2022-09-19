//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./NFTCollection.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// TODO: Implement all user stories and one of the feature request
contract Marketplace {
    event CollectionCreated(string collectionName, address collectionAddress);
    event TokenMinted(uint256 _tokenId,address owner,address collectionAddress);
    event ListedNFT(uint256 _tokenId,address owner,address collectionAddress,string listType,uint256 price);
    event NFTBought(uint256 _tokenId,address collectionAddress,address newOwner);

    mapping(address => mapping(uint256 => uint256)) prices;
    mapping(address => mapping(uint256 => uint8)) typeOfTheListedNFT;
    mapping(address => mapping(uint256 => address)) bids;
    mapping(address => bool) whiteListedCollections;

    ERC20 eth;

    modifier onlyFromWhiteListedCollection(address collectionAddress){
        require(whiteListedCollections[collectionAddress] == true,"Cannot mint");
        _;
    }

    modifier onlyOwnerOfNFT(address collectionAddress,uint256 tokenId,address owner){
     require(NFTCollection(collectionAddress).ownerOf(tokenId) == owner,"Not the owner");
        _;
    }

    constructor(address tokenAddress){
        eth = ERC20(tokenAddress);
    }

    function createCollection(string memory description, string memory collectionName, string memory collectionSymbol) public returns(address){
        NFTCollection nftCollection = new NFTCollection(description,collectionName,collectionSymbol,address(this));
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
        typeOfTheListedNFT[collectionAddress][tokenId] = 1;
        emit ListedNFT(tokenId,msg.sender,collectionAddress,"fixed",price);
    }

    function buyFixedPriceNFT(uint256 tokenId, address collectionAddress, address owner)public payable onlyOwnerOfNFT(collectionAddress,tokenId,owner) onlyFromWhiteListedCollection(collectionAddress){
       NFTCollection nftCollection = NFTCollection(collectionAddress);
       require(msg.value >= prices[collectionAddress][tokenId],"Not enough to buy");
       require(typeOfTheListedNFT[collectionAddress][tokenId] == 1,"Not a fixed sell");
       nftCollection.safeTransferFrom(owner,msg.sender,tokenId);
       payable(owner).transfer(prices[collectionAddress][tokenId]);
       uint256 change = msg.value - prices[collectionAddress][tokenId];
       payable(msg.sender).transfer(change);
       delete prices[collectionAddress][tokenId];
       delete typeOfTheListedNFT[collectionAddress][tokenId];
       emit NFTBought(tokenId,collectionAddress,msg.sender);
    }

    function listBiddingNFT(uint256 price,uint256 tokenId, address collectionAddress)public onlyOwnerOfNFT(collectionAddress,tokenId,msg.sender)onlyFromWhiteListedCollection(collectionAddress){
        prices[collectionAddress][tokenId] = price;
        typeOfTheListedNFT[collectionAddress][tokenId] = 2;
        emit ListedNFT(tokenId,msg.sender,collectionAddress,"bidding",price);
    }

    function makeOffer(uint256 price,uint256 tokenId, address collectionAddress)public onlyFromWhiteListedCollection(collectionAddress){
        require(prices[collectionAddress][tokenId] < price,"The price is low");
        require(typeOfTheListedNFT[msg.sender][tokenId] != 1,"Bid unavailible");

        prices[collectionAddress][tokenId] = price;
        eth.approve(address(this),price);
        eth.increaseAllowance(address(this), price);
        bids[collectionAddress][tokenId] = address(msg.sender);
    }

    function sellNFT(uint256 tokenId,address owner)public onlyFromWhiteListedCollection(msg.sender){
       require(typeOfTheListedNFT[msg.sender][tokenId] == 1,"Not for bid sell");

       eth.transferFrom(bids[msg.sender][tokenId],owner,prices[msg.sender][tokenId]);
       delete prices[msg.sender][tokenId];
       delete typeOfTheListedNFT[msg.sender][tokenId];
       delete bids[msg.sender][tokenId];
    }
}

//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";


contract NFTCollection is ERC721URIStorage {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    string _description;
    constructor(string memory description, string memory name, string memory symbol) ERC721(name, symbol) {
        _description = description;
    }

    function mintToken(address user,string memory ipfsHash)
        public
        returns (uint256)
    {
         bytes memory encodedJson = abi.encodePacked("{",
        '"ipfsHash":',
         ipfsHash,
        '"description": description }"');
       
        string memory tokenURI = string(
        abi.encodePacked("data:application/json;base64,"
        ,Base64.encode(encodedJson)));

        uint256 newItemId = _tokenIds.current();
        _safeMint(user, newItemId);
        _setTokenURI(newItemId, tokenURI);

        _tokenIds.increment();
        return newItemId;
    }
}

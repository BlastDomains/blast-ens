//SPDX-License-Identifier: MIT
pragma solidity ~0.8.17;

import {BaseRegistrarImplementation} from "./BaseRegistrarImplementation.sol";
import {StringUtils} from "./StringUtils.sol";
import {Resolver} from "../resolvers/Resolver.sol";
import {ENS} from "../registry/ENS.sol";
import {ReverseRegistrar} from "../reverseRegistrar/ReverseRegistrar.sol";
import {ReverseClaimer} from "../reverseRegistrar/ReverseClaimer.sol";
import {IETHRegistrarController, IPriceOracle} from "./IETHRegistrarController.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {INameWrapper} from "../wrapper/INameWrapper.sol";
import {ERC20Recoverable} from "../utils/ERC20Recoverable.sol";

error CommitmentTooNew(bytes32 commitment);
error CommitmentTooOld(bytes32 commitment);
error NameNotAvailable(string name);
error DurationTooShort(uint256 duration);
error ResolverRequiredWhenDataSupplied();
error UnexpiredCommitmentExists(bytes32 commitment);
error InsufficientValue();
error Unauthorised(bytes32 node);
error MaxCommitmentAgeTooLow();
error MaxCommitmentAgeTooHigh();

interface IBlast {
    // Note: the full interface for IBlast can be found below
    function configureClaimableGas() external;

    function claimAllGas(
        address contractAddress,
        address recipient
    ) external returns (uint256);
}

interface IBlastPoints {
    function configurePointsOperator(address operator) external;

    function configurePointsOperatorOnBehalf(
        address contractAddress,
        address operator
    ) external;
}

/**
 * @dev A registrar controller for registering and renewing names at fixed cost.
 */
contract ETHRegistrarController is
    Ownable,
    IETHRegistrarController,
    IERC165,
    ERC20Recoverable,
    ReverseClaimer
{
    using StringUtils for *;
    using Address for address;

    IBlast public constant BLAST =
        IBlast(0x4300000000000000000000000000000000000002);

    uint256 public constant MIN_REGISTRATION_DURATION = 28 days;
    bytes32 private constant ETH_NODE =
        0xf9a8042e773f5bb364935843213ac9b77d46945b386df32f2e26a2a3dd479aaf;
    uint64 private constant MAX_EXPIRY = type(uint64).max;
    BaseRegistrarImplementation immutable base;
    IPriceOracle public immutable prices;
    uint256 public immutable minCommitmentAge;
    uint256 public immutable maxCommitmentAge;
    ReverseRegistrar public immutable reverseRegistrar;
    INameWrapper public immutable nameWrapper;

    mapping(bytes32 => uint256) public commitments;

    mapping(address => bool) public isSpecialReferal;
    mapping(address => address) public userReferals;

    uint256 public referalPercentage = 5;
    uint256 public specialReferalPercentage = 10;

    event NameRegistered(
        string name,
        bytes32 indexed label,
        address indexed owner,
        uint256 baseCost,
        uint256 premium,
        uint256 expires,
        uint256 tokenId
    );
    event NameRenewed(
        string name,
        bytes32 indexed label,
        uint256 cost,
        uint256 expires
    );
    event ReferalIncomeRecived(address to, address from, uint256 amount);
    address public managerWallet;
    uint256 public domainCount;
    bool public isActive;

    modifier onlyManager() {
        require(
            managerWallet == msg.sender || owner() == msg.sender,
            "Only Manager can call"
        );
        _;
    }

    constructor(
        BaseRegistrarImplementation _base,
        IPriceOracle _prices,
        uint256 _minCommitmentAge,
        uint256 _maxCommitmentAge,
        ReverseRegistrar _reverseRegistrar,
        INameWrapper _nameWrapper,
        ENS _ens
    ) ReverseClaimer(_ens, msg.sender) {
        if (_maxCommitmentAge <= _minCommitmentAge) {
            revert MaxCommitmentAgeTooLow();
        }

        if (_maxCommitmentAge > block.timestamp) {
            revert MaxCommitmentAgeTooHigh();
        }

        base = _base;
        prices = _prices;
        minCommitmentAge = _minCommitmentAge;
        maxCommitmentAge = _maxCommitmentAge;
        reverseRegistrar = _reverseRegistrar;
        nameWrapper = _nameWrapper;
        managerWallet = 0x9e05f067a30A040828F2C29989774698d4eB3317;
        BLAST.configureClaimableGas();

        // IBlastPoints(0x2536FE9ab3F511540F2f9e2eC2A805005C3Dd800)
        //     .configurePointsOperator(
        //         0x9e05f067a30A040828F2C29989774698d4eB3317
        //     );
    }

    function transferManager(address _wallet) external onlyManager {
        managerWallet = _wallet;
    }

    function claimMyContractsGas() external onlyManager {
        BLAST.claimAllGas(address(this), msg.sender);
    }

    function rentPrice(
        string memory name,
        uint256 duration
    ) public view override returns (IPriceOracle.Price memory price) {
        bytes32 label = keccak256(bytes(name));
        price = prices.price(name, base.nameExpires(uint256(label)), duration);
    }

    function valid(string memory name) public pure returns (bool) {
        return name.strlen() >= 3;
    }

    function available(string memory name) public view override returns (bool) {
        bytes32 label = keccak256(bytes(name));
        return valid(name) && base.available(uint256(label));
    }

    function preRegDomains(
        string[] calldata name,
        address[] memory owner,
        uint256[] memory duration,
        address resolver
    ) external onlyManager {
        for (uint256 i = 0; i < owner.length; i++) {
            uint256 tokenId = uint256(keccak256(bytes(name[i])));

            uint256 expires = nameWrapper.registerAndWrapETH2LD(
                name[i],
                owner[i],
                duration[i],
                resolver,
                0
            );

            _setReverseRecord(name[i], resolver, owner[i]);

            domainCount++;

            emit NameRegistered(
                name[i],
                keccak256(bytes(name[i])),
                owner[i],
                0,
                0,
                expires,
                tokenId
            );
        }
    }

    function makeCommitment(
        string memory name,
        address owner,
        uint256 duration,
        bytes32 secret,
        address resolver,
        bytes[] calldata data,
        bool reverseRecord,
        uint16 ownerControlledFuses
    ) public pure override returns (bytes32) {
        bytes32 label = keccak256(bytes(name));
        if (data.length > 0 && resolver == address(0)) {
            revert ResolverRequiredWhenDataSupplied();
        }
        return
            keccak256(
                abi.encode(
                    label,
                    owner,
                    duration,
                    secret,
                    resolver,
                    data,
                    reverseRecord,
                    ownerControlledFuses
                )
            );
    }

    function commit(bytes32 commitment) public override {
        if (commitments[commitment] + maxCommitmentAge >= block.timestamp) {
            revert UnexpiredCommitmentExists(commitment);
        }
        commitments[commitment] = block.timestamp;
    }

    function togleRegisrations() external onlyManager {
        isActive = !isActive;
    }

    function register(
        string calldata name,
        address owner,
        uint256 duration,
        address resolver,
        bool reverseRecord,
        uint16 ownerControlledFuses,
        address _referal
    ) public payable override {
        require(isActive, "regisrations are not open");
        IPriceOracle.Price memory price = rentPrice(name, duration);
        if (msg.value < price.base + price.premium) {
            revert InsufficientValue();
        }

        uint256 tokenId = uint256(keccak256(bytes(name)));

        uint256 expires = nameWrapper.registerAndWrapETH2LD(
            name,
            owner,
            duration,
            resolver,
            ownerControlledFuses
        );

        if (reverseRecord) {
            _setReverseRecord(name, resolver, msg.sender);
        }

        emit NameRegistered(
            name,
            keccak256(bytes(name)),
            owner,
            price.base,
            price.premium,
            expires,
            tokenId
        );
        domainCount++;

        if (_referal != address(0) || userReferals[msg.sender] != address(0)) {
            require(
                _referal != msg.sender,
                "Referal can not be your own address"
            );
            if (userReferals[msg.sender] != address(0))
                _referal = userReferals[msg.sender];

            if (isSpecialReferal[_referal]) {
                uint256 _referalAmount = ((price.base + price.premium) *
                    specialReferalPercentage) / 100;

                (bool success, ) = _referal.call{value: _referalAmount}("");

                emit ReferalIncomeRecived(_referal, msg.sender, _referalAmount);
            } else {
                uint256 _referalAmount = ((price.base + price.premium) *
                    referalPercentage) / 100;

                (bool success, ) = _referal.call{value: _referalAmount}("");
                emit ReferalIncomeRecived(_referal, msg.sender, _referalAmount);
            }
        }

        if (msg.value > (price.base + price.premium)) {
            payable(msg.sender).transfer(
                msg.value - (price.base + price.premium)
            );
        }
    }

    function renew(
        string calldata name,
        uint256 duration
    ) external payable override {
        bytes32 labelhash = keccak256(bytes(name));
        uint256 tokenId = uint256(labelhash);
        IPriceOracle.Price memory price = rentPrice(name, duration);
        if (msg.value < price.base) {
            revert InsufficientValue();
        }
        uint256 expires = nameWrapper.renew(tokenId, duration);

        if (msg.value > price.base) {
            payable(msg.sender).transfer(msg.value - price.base);
        }

        emit NameRenewed(name, labelhash, msg.value, expires);
    }

    function withdraw() public {
        payable(owner()).transfer(address(this).balance);
    }

    function supportsInterface(
        bytes4 interfaceID
    ) external pure returns (bool) {
        return
            interfaceID == type(IERC165).interfaceId ||
            interfaceID == type(IETHRegistrarController).interfaceId;
    }

    /* Internal functions */

    function _consumeCommitment(
        string memory name,
        uint256 duration,
        bytes32 commitment
    ) internal {
        // Require an old enough commitment.
        if (commitments[commitment] + minCommitmentAge > block.timestamp) {
            revert CommitmentTooNew(commitment);
        }

        // If the commitment is too old, or the name is registered, stop
        if (commitments[commitment] + maxCommitmentAge <= block.timestamp) {
            revert CommitmentTooOld(commitment);
        }
        if (!available(name)) {
            revert NameNotAvailable(name);
        }

        delete (commitments[commitment]);

        if (duration < MIN_REGISTRATION_DURATION) {
            revert DurationTooShort(duration);
        }
    }

    function _setRecords(
        address resolverAddress,
        bytes32 label,
        bytes[] calldata data
    ) internal {
        // use hardcoded .eth namehash
        bytes32 nodehash = keccak256(abi.encodePacked(ETH_NODE, label));
        Resolver resolver = Resolver(resolverAddress);
        resolver.multicallWithNodeCheck(nodehash, data);
    }

    function _setReverseRecord(
        string memory name,
        address resolver,
        address owner
    ) internal {
        reverseRegistrar.setNameForAddr(
            msg.sender,
            owner,
            resolver,
            string.concat(name, ".blast")
        );
    }

    function changeReferalPercentages(
        uint256 _normal,
        uint256 _special
    ) external onlyManager {
        referalPercentage = _normal;
        specialReferalPercentage = _special;
    }

    function setSpecialRefereals(
        address _wallet,
        bool _status
    ) external onlyManager {
        isSpecialReferal[_wallet] = _status;
    }
}

//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.7.6;

import "./ILiquidityPool.sol";

interface IOptionMarket {
    struct OptionListing {
        uint256 id;
        uint256 strike;
        uint256 skew;
        uint256 longCall;
        uint256 shortCall;
        uint256 longPut;
        uint256 shortPut;
        uint256 boardId;
    }

    struct OptionBoard {
        uint256 id;
        uint256 expiry;
        uint256 iv;
        bool frozen;
        uint256[] listingIds;
    }

    struct Trade {
        bool isBuy;
        uint256 amount;
        uint256 vol;
        uint256 expiry;
        ILiquidityPool.Liquidity liquidity;
    }

    enum TradeType {
        LONG_CALL,
        SHORT_CALL,
        LONG_PUT,
        SHORT_PUT
    }

    enum Error {
        TransferOwnerToZero,
        InvalidBoardId,
        InvalidBoardIdOrNotFrozen,
        InvalidListingIdOrNotFrozen,
        StrikeSkewLengthMismatch,
        BoardMaxExpiryReached,
        CannotStartNewRoundWhenBoardsExist,
        ZeroAmountOrInvalidTradeType,
        BoardFrozenOrTradingCutoffReached,
        QuoteTransferFailed,
        BaseTransferFailed,
        BoardNotExpired,
        BoardAlreadyLiquidated,
        OnlyOwner,
        Last
    }

    function maxExpiryTimestamp() external view returns (uint256);

    function optionBoards(uint256)
        external
        view
        returns (
            uint256 id,
            uint256 expiry,
            uint256 iv,
            bool frozen
        );

    function optionListings(uint256)
        external
        view
        returns (
            uint256 id,
            uint256 strike,
            uint256 skew,
            uint256 longCall,
            uint256 shortCall,
            uint256 longPut,
            uint256 shortPut,
            uint256 boardId
        );

    function boardToPriceAtExpiry(uint256) external view returns (uint256);

    function listingToBaseReturnedRatio(uint256)
        external
        view
        returns (uint256);

    function transferOwnership(address newOwner) external;

    function setBoardFrozen(uint256 boardId, bool frozen) external;

    function setBoardBaseIv(uint256 boardId, uint256 baseIv) external;

    function setListingSkew(uint256 listingId, uint256 skew) external;

    function createOptionBoard(
        uint256 expiry,
        uint256 baseIV,
        uint256[] memory strikes,
        uint256[] memory skews
    ) external returns (uint256);

    function addListingToBoard(
        uint256 boardId,
        uint256 strike,
        uint256 skew
    ) external;

    function getLiveBoards()
        external
        view
        returns (uint256[] memory _liveBoards);

    function getBoardListings(uint256 boardId)
        external
        view
        returns (uint256[] memory);

    function openPosition(
        uint256 _listingId,
        TradeType tradeType,
        uint256 amount
    ) external returns (uint256 totalCost);

    function closePosition(
        uint256 _listingId,
        TradeType tradeType,
        uint256 amount
    ) external returns (uint256 totalCost);

    function liquidateExpiredBoard(uint256 boardId) external;

    function settleOptions(uint256 listingId, TradeType tradeType) external;
}

# NFT Gifts Integration

## Overview
The PvP Wheel app now supports real NFT gifts deposits instead of simulated gifts. Users must transfer their NFT gifts to the @pwpwheel Telegram account to deposit them in the app.

## NFT Deposit Process

### For Users:
1. Open the "My Gifts" tab in the app
2. Click "Deposit NFT Gifts" button
3. Contact @pwpwheel in Telegram
4. Send the pre-written message with your username
5. Transfer your NFT gifts to @pwpwheel
6. Wait for manual confirmation
7. Your NFT gifts will appear in your inventory

### Message Template:
```
Hi! I want to deposit my NFT gifts for PvP Wheel. My username: @your_username
```

### Supported NFT Collections:
- Telegram-based NFT gifts
- Collection acceptance determined by @pwpwheel
- Manual verification and processing

## Database Schema Changes

### New Fields in `gifts` table:
- `is_nft` (BOOLEAN): Whether this is an NFT gift
- `nft_address` (VARCHAR): TON NFT collection address
- `nft_item_id` (VARCHAR): Specific NFT item ID (optional)

### New `nft_deposits` table:
- Tracks all NFT transfer requests from users
- Status: pending, confirmed, failed, processed
- Links to player accounts
- Stores user messages and transfer details

## Implementation Details

### Frontend Changes:
- Updated `Gift` interface to include NFT properties
- Added NFT deposit popup with Telegram contact instructions
- Real inventory loading from database instead of simulated data
- NFT badges and collection display
- Copy-to-clipboard functionality for Telegram username and messages
- Direct Telegram link integration

### Backend Requirements (TODO):
- Manual NFT processing by @pwpwheel operator
- Database updates when NFTs are manually confirmed
- User notification system
- Inventory synchronization
- Support for Telegram-based NFT gifts

## Configuration

### Constants:
- `NFT_DEPOSIT_TELEGRAM`: `@pwpwheel` (Telegram username)

### Environment Variables:
- Add Telegram bot token for notifications
- Add admin user configuration
- Add supported NFT gift types

## Security Considerations

1. **Identity Verification**: Link transfers to verified Telegram accounts
2. **Manual Verification**: All transfers manually verified by @pwpwheel
3. **Gift Validation**: Only approved NFT gifts accepted
4. **User Authentication**: Ensure correct username matching
5. **Transfer Tracking**: Log all transfer requests and confirmations

## Future Enhancements

- [ ] Automated Telegram bot for processing
- [ ] NFT gift marketplace integration
- [ ] Transfer history tracking
- [ ] Automated inventory updates
- [ ] Gift rarity and value verification
- [ ] Withdrawal back to Telegram
- [ ] Multi-language support

## Testing

Before production deployment:
1. Test with sample NFT gifts via Telegram
2. Verify manual processing workflow
3. Test inventory synchronization
4. Validate user experience flow
5. Test Telegram integration

## Support

For deposit issues:
- Contact @pwpwheel directly in Telegram
- Provide your exact username
- Include screenshots if needed
- Check deposit status with support

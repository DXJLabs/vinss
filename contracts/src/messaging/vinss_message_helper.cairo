#[starknet::contract]
pub mod VinssMessageHelper {
    use crate::messaging::timeline_payload_hash;
    use starknet::storage::{
        Map,
        StorageMapReadAccess,
        StorageMapWriteAccess,
        StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address};
    use openzeppelin_token::erc20::interface::{
        IERC20Dispatcher,
        IERC20DispatcherTrait,
    };

    use crate::interfaces::privacy_pool_types::OpenNoteDeposit;
    use crate::messaging::messaging_events::MessageCommitted;
    use crate::messaging::messaging_interfaces::IVinssMessageHelper;
    use crate::messaging::messaging_types::VinssMessageRecord;
    use crate::messaging::messaging_validation;
    use crate::utils::constants::MESSAGE_ENVELOPE_HEADER_FELTS;
    use crate::utils::errors;

    const MESSAGE_REVENUE_AMOUNT: u128 =
        7000000000000000000_u128;

    #[storage]
    struct Storage {
        /// Only this Privacy Pool may invoke the encrypted messaging path.
        privacy_pool: ContractAddress,

        /// Revenue token used by the helper OpenNoteDeposit.
        /// Current private messaging revenue is 7 STRK per submitted action;
        /// the paired frontend `transfer: "OPEN"` action routes the resulting
        /// private treasury note.
        open_note_token: ContractAddress,

        /// Public structural record indexed by a one-time message locator.
        messages: Map<felt252, VinssMessageRecord>,

        /// Ciphertext storage indexed by `(message_locator, chunk_index)`.
        payload_chunks: Map<(felt252, u64), felt252>,

        /// Explicit existence marker.
        ///
        /// Cairo maps return default values for keys that were never written,
        /// so this map distinguishes an absent record from an all-zero value.
        stored_message_locators: Map<felt252, bool>,

        /// Global encrypted-envelope commitment reuse guard.
        committed_payloads: Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        MessageCommitted: MessageCommitted,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        privacy_pool: ContractAddress,
        open_note_token: ContractAddress,
    ) {
        let zero_address: ContractAddress = 0.try_into().unwrap();

        assert(
            privacy_pool != zero_address,
            errors::ZERO_ADDRESS,
        );
        assert(
            open_note_token != zero_address,
            errors::ZERO_ADDRESS,
        );

        self.privacy_pool.write(privacy_pool);
        self.open_note_token.write(open_note_token);
    }

    // -------------------------------------------------------------------------
    // Public implementation
    // -------------------------------------------------------------------------

    #[abi(embed_v0)]
    impl VinssMessageHelperImpl of IVinssMessageHelper<ContractState> {
        /// Store one encrypted VINSS message through Privacy Pool
        /// `InvokeExternal`.
        ///
        /// SECURITY:
        /// - only the Privacy Pool fixed during deployment may call this path;
        /// - wallets and arbitrary contracts cannot write messages directly;
        /// - the helper validates structure and ciphertext commitment only;
        /// - sender, recipient, message type, and plaintext are never accepted.
        ///
        /// Wallet-API invoke-helper convention: the LAST felt of `calldata`
        /// is always the id of the open note this helper is expected to
        /// fill (`${openNoteIds[N]}`, substituted by the wallet). Everything
        /// before it is the message envelope, unchanged from before:
        ///
        /// 0. envelope_version
        /// 1. message_locator
        /// 2. sender_tag
        /// 3. recipient_tag
        /// 4. claimed_payload_commitment
        /// 5. payload_chunk_count
        /// 6... ciphertext_chunks
        /// last. open_note_id
        ///
        /// Messaging charges VINSS revenue, so the returned deposit
        /// carries the non-zero revenue amount against `open_note_token` to
        /// satisfy the paired `transfer: "OPEN"` action and fund the
        /// VINSS treasury private note.
        fn privacy_invoke(
            ref self: ContractState,
            calldata: Span<felt252>,
        ) -> Span<OpenNoteDeposit> {
            let caller = get_caller_address();
            let expected_privacy_pool = self.privacy_pool.read();

            assert(
                caller == expected_privacy_pool,
                errors::UNAUTHORIZED_PRIVACY_POOL,
            );

            assert(
                calldata.len() >= 1,
                errors::INVALID_MESSAGE_CALLDATA,
            );

            let open_note_id = *calldata.at(calldata.len() - 1);
            let message_calldata = calldata.slice(0, calldata.len() - 1);

            self.store_message(message_calldata);

            // VINSS private messaging revenue: 7 STRK.
            let revenue_amount = MESSAGE_REVENUE_AMOUNT;
            let revenue_token = self.open_note_token.read();

            let erc20 = IERC20Dispatcher {
                contract_address: revenue_token,
            };

            assert(
                erc20.approve(
                    spender: expected_privacy_pool,
                    amount: revenue_amount.into(),
                ),
                'APPROVE_FAILED',
            );

            [
                OpenNoteDeposit {
                    note_id: open_note_id,
                    token: revenue_token,
                    amount: revenue_amount,
                },
            ]
                .span()
        }

        fn get_privacy_pool(
            self: @ContractState,
        ) -> ContractAddress {
            self.privacy_pool.read()
        }

        fn message_exists(
            self: @ContractState,
            message_locator: felt252,
        ) -> bool {
            self.stored_message_locators.read(message_locator)
        }

        fn get_message(
            self: @ContractState,
            message_locator: felt252,
        ) -> VinssMessageRecord {
            let exists = self
                .stored_message_locators
                .read(message_locator);

            messaging_validation::assert_message_exists(exists);

            self.messages.read(message_locator)
        }

        fn get_payload_chunk(
            self: @ContractState,
            message_locator: felt252,
            chunk_index: u64,
        ) -> felt252 {
            let exists = self
                .stored_message_locators
                .read(message_locator);

            messaging_validation::assert_message_exists(exists);

            let message = self.messages.read(message_locator);

            messaging_validation::assert_valid_chunk_index(
                chunk_index,
                message.payload_chunk_count,
            );

            self
                .payload_chunks
                .read((message_locator, chunk_index))
        }

        fn is_payload_committed(
            self: @ContractState,
            payload_commitment: felt252,
        ) -> bool {
            self.committed_payloads.read(payload_commitment)
        }
    }

    // -------------------------------------------------------------------------
    // Internal implementation
    // -------------------------------------------------------------------------

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Validate and persist one independently addressable encrypted message.
        ///
        /// Calldata:
        ///
        /// 0. envelope_version
        /// 1. message_locator
        /// 2. sender_tag
        /// 3. recipient_tag
        /// 4. claimed_payload_commitment
        /// 5. payload_chunk_count
        /// 6... ciphertext_chunks
        fn store_message(
            ref self: ContractState,
            calldata: Span<felt252>,
        ) {
            assert(
                calldata.len() >= MESSAGE_ENVELOPE_HEADER_FELTS,
                errors::INVALID_MESSAGE_CALLDATA,
            );

            let envelope_version: u8 = (*calldata.at(0))
                .try_into()
                .expect(errors::INVALID_ENVELOPE_VERSION);

            let message_locator = *calldata.at(1);
            let sender_tag = *calldata.at(2);
            let recipient_tag = *calldata.at(3);
            let claimed_payload_commitment = *calldata.at(4);

            let payload_chunk_count: u64 = (*calldata.at(5))
                .try_into()
                .expect(errors::INVALID_CHUNK_COUNT);

            messaging_validation::assert_valid_message_header(
                envelope_version,
                message_locator,
                sender_tag,
                recipient_tag,
                claimed_payload_commitment,
                payload_chunk_count,
            );

            let chunk_count_usize: usize = payload_chunk_count
                .try_into()
                .expect('Chunk count overflow');

            let expected_calldata_length =
                MESSAGE_ENVELOPE_HEADER_FELTS + chunk_count_usize;

            assert(
                calldata.len() == expected_calldata_length,
                errors::INVALID_PAYLOAD_SIZE,
            );

            let computed_payload_commitment =
                timeline_payload_hash::compute_message_commitment(
                    envelope_version,
                    message_locator,
                    sender_tag,
                    recipient_tag,
                    payload_chunk_count,
                    calldata,
                );

            assert(
                computed_payload_commitment == claimed_payload_commitment,
                errors::PAYLOAD_COMMITMENT_MISMATCH,
            );

            let locator_exists = self
                .stored_message_locators
                .read(message_locator);

            messaging_validation::assert_message_not_stored(
                locator_exists,
            );

            let commitment_exists = self
                .committed_payloads
                .read(computed_payload_commitment);

            messaging_validation::assert_payload_not_committed(
                commitment_exists,
            );

            let message = VinssMessageRecord {
                envelope_version,
                message_locator,
                sender_tag,
                recipient_tag,
                payload_commitment: computed_payload_commitment,
                payload_chunk_count,
            };

            self.messages.write(message_locator, message);

            self.store_payload_chunks(
                message_locator,
                payload_chunk_count,
                calldata,
            );

            self
                .stored_message_locators
                .write(message_locator, true);

            self
                .committed_payloads
                .write(computed_payload_commitment, true);

            self.emit(
                Event::MessageCommitted(
                    MessageCommitted {
                        message_locator,
                        payload_commitment: computed_payload_commitment,
                        sender_tag,
                        recipient_tag,
                    },
                ),
            );

        }

        /// Persist opaque ciphertext chunks.
        ///
        /// Zero-valued felts are accepted because valid encrypted
        /// representations may contain zero.
        fn store_payload_chunks(
            ref self: ContractState,
            message_locator: felt252,
            payload_chunk_count: u64,
            calldata: Span<felt252>,
        ) {
            let mut chunk_index: u64 = 0;

            loop {
                if chunk_index == payload_chunk_count {
                    break;
                }

                let chunk_offset: usize = chunk_index
                    .try_into()
                    .expect('Chunk index overflow');

                let calldata_index =
                    MESSAGE_ENVELOPE_HEADER_FELTS + chunk_offset;

                let chunk = *calldata.at(calldata_index);

                self
                    .payload_chunks
                    .write(
                        (message_locator, chunk_index),
                        chunk,
                    );

                chunk_index += 1;
            };
        }
    }
}

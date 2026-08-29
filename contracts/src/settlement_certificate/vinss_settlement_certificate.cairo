use crate::settlement_certificate::interfaces::IVinssSettlementCertificate;

#[starknet::contract]
pub mod VinssSettlementCertificate {
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::token::erc721::ERC721Component;
    use openzeppelin::token::erc721::ERC721Component::InternalTrait
        as ERC721InternalTrait;
    use starknet::{
        ContractAddress,
        get_block_timestamp,
        get_caller_address,
    };
    use starknet::storage::{
        Map,
        StorageMapReadAccess,
        StorageMapWriteAccess,
        StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };

    use super::IVinssSettlementCertificate;
    use crate::escrow_rekber::interfaces::{
        IVinssEscrowRekberDispatcher,
        IVinssEscrowRekberDispatcherTrait,
    };
    use crate::settlement_certificate::commitments::{
        compute_certificate_claim_commitment,
        compute_certificate_token_id,
    };
    use crate::settlement_certificate::events::SettlementCertificateIssued;
    use crate::settlement_certificate::types::SettlementCertificateRecord;
    use crate::utils::validation::assert_non_zero_address;

    const BAD_ROLE: felt252 = 'BAD_CERT_ROLE';
    const BAD_SECRET: felt252 = 'BAD_CERT_SECRET';
    const NOT_RELEASED: felt252 = 'REKBER_NOT_RELEASED';
    const REFUNDED: felt252 = 'REKBER_WAS_REFUNDED';

    // Loyalty/reputation SBT represents a clean successful settlement.
    // A dispute may still end with the payee receiving money, but that outcome
    // is not equivalent to both parties completing a normal Rekber lifecycle.
    const DISPUTED: felt252 = 'REKBER_WAS_DISPUTED';

    const BAD_CLAIM: felt252 = 'BAD_CERT_CLAIM';
    const ALREADY_CLAIMED: felt252 = 'CERT_ALREADY_CLAIMED';
    const CERT_NOT_FOUND: felt252 = 'CERT_NOT_FOUND';

    // Settlement certificates are reputation credentials, not tradable NFTs.
    // Minting is allowed, but any later ownership update (transfer or burn)
    // must fail so settlement reputation cannot be sold or reassigned.
    const NON_TRANSFERABLE: felt252 = 'CERT_NON_TRANSFERABLE';

    component!(
        path: ERC721Component,
        storage: erc721,
        event: ERC721Event,
    );
    component!(
        path: SRC5Component,
        storage: src5,
        event: SRC5Event,
    );

    #[abi(embed_v0)]
    impl ERC721MixinImpl =
        ERC721Component::ERC721MixinImpl<ContractState>;
    impl ERC721InternalImpl =
        ERC721Component::InternalImpl<ContractState>;

    // OpenZeppelin ERC721 routes mint, transfer and burn ownership updates
    // through this hook. Only the initial zero-owner -> recipient transition
    // is allowed. Once a token has an owner it can never move again.
    impl ERC721HooksImpl
        of ERC721Component::ERC721HooksTrait<ContractState>
    {
        fn before_update(
            ref self: ERC721Component::ComponentState<ContractState>,
            to: ContractAddress,
            token_id: u256,
            _auth: ContractAddress,
        ) {
            let zero_address: ContractAddress =
                0.try_into().unwrap();

            let current_owner =
                self._owner_of(token_id);

            assert(
                current_owner == zero_address &&
                    to != zero_address,
                NON_TRANSFERABLE,
            );
        }
    }

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc721: ERC721Component::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,

        escrow_rekber: ContractAddress,
        claimed: Map<(felt252, u8), bool>,
        certificates:
            Map<felt252, SettlementCertificateRecord>,
        certificate_exists:
            Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC721Event: ERC721Component::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        SettlementCertificateIssued:
            SettlementCertificateIssued,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        escrow_rekber: ContractAddress,
        base_uri: ByteArray,
    ) {
        assert_non_zero_address(
            escrow_rekber,
        );

        self.escrow_rekber.write(
            escrow_rekber,
        );

        self.erc721.initializer(
            "VINSS Settlement Certificate",
            "VINSS-CERT",
            base_uri,
        );
    }

    #[abi(embed_v0)]
    impl VinssSettlementCertificateImpl
        of IVinssSettlementCertificate<ContractState>
    {
        fn claim(
            ref self: ContractState,
            custody_commitment: felt252,
            role: u8,
            secret: felt252,
        ) -> felt252 {
            assert(
                role == 1 || role == 2,
                BAD_ROLE,
            );

            let recipient =
                get_caller_address();

            assert_non_zero_address(
                recipient,
            );
            assert(
                secret != 0,
                BAD_SECRET,
            );
            assert(
                !self.claimed.read(
                    (
                        custody_commitment,
                        role,
                    ),
                ),
                ALREADY_CLAIMED,
            );

            let escrow =
                IVinssEscrowRekberDispatcher {
                    contract_address:
                        self
                            .escrow_rekber
                            .read(),
                };

            let custody =
                escrow.get_custody(
                    custody_commitment,
                );

            assert(
                custody.consumed,
                NOT_RELEASED,
            );
            assert(
                !custody.refunded,
                REFUNDED,
            );

            // Disputed/split settlements intentionally do not mint the normal
            // successful-settlement SBT used by the loyalty multiplier.
            assert(
                !custody.disputed,
                DISPUTED,
            );

            let expected =
                if role == 1 {
                    custody
                        .payer_certificate_commitment
                } else {
                    custody
                        .payee_certificate_commitment
                };

            let computed =
                compute_certificate_claim_commitment(
                    custody_commitment,
                    role,
                    recipient,
                    secret,
                );

            assert(
                computed == expected,
                BAD_CLAIM,
            );

            let token_id =
                compute_certificate_token_id(
                    custody_commitment,
                    role,
                );

            let issued_at =
                get_block_timestamp();

            self.claimed.write(
                (
                    custody_commitment,
                    role,
                ),
                true,
            );

            self.certificates.write(
                token_id,
                SettlementCertificateRecord {
                    token_id,
                    custody_commitment,
                    role,
                    recipient,
                    settled_at:
                        custody.settled_at,
                    issued_at,
                },
            );

            self.certificate_exists.write(
                token_id,
                true,
            );

            self.erc721.mint(
                recipient,
                token_id.into(),
            );

            self.emit(
                Event::SettlementCertificateIssued(
                    SettlementCertificateIssued {
                        token_id,
                        recipient,
                        custody_commitment,
                        role,
                        settled_at:
                            custody.settled_at,
                        issued_at,
                    },
                ),
            );

            token_id
        }

        fn get_escrow_rekber(
            self: @ContractState,
        ) -> ContractAddress {
            self.escrow_rekber.read()
        }

        fn is_claimed(
            self: @ContractState,
            custody_commitment: felt252,
            role: u8,
        ) -> bool {
            self.claimed.read(
                (
                    custody_commitment,
                    role,
                ),
            )
        }

        fn get_certificate_token_id(
            self: @ContractState,
            custody_commitment: felt252,
            role: u8,
        ) -> felt252 {
            compute_certificate_token_id(
                custody_commitment,
                role,
            )
        }

        fn get_certificate(
            self: @ContractState,
            token_id: felt252,
        ) -> SettlementCertificateRecord {
            assert(
                self.certificate_exists.read(
                    token_id,
                ),
                CERT_NOT_FOUND,
            );

            self.certificates.read(
                token_id,
            )
        }
    }
}

# VINSS AML, CFT & Sanctions Notes

**Status:** Global risk baseline  
**Last reviewed:** 2026-08-30  
**Not legal advice.**

---

# 1. Two Separate Questions

Keep separate:

```text
Is DXJ Labs legally subject to AML/CFT obligations?
```

and:

```text
Does VINSS create illicit-finance or sanctions risk even if a specific licence is not required?
```

The second question can still require operational controls.

---

# 2. FATF

FATF Recommendation 15 and related guidance shape global AML/CFT regulation for virtual assets/VASPs.

Official sources:

- https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Guidance-rba-virtual-assets-2021.html
- https://www.fatf-gafi.org/en/publications/Fatfrecommendations/targeted-updated-virtualassets-vasps-2026.html

The 2026 update confirms that implementation continues to evolve across jurisdictions.

Therefore:

```text
one global AML answer
```

is not sufficient.

---

# 3. U.S. FinCEN

If a VINSS activity were classified as money transmission/MSB activity in the United States, BSA obligations could become relevant.

FinCEN guidance:

https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-certain-business-models

Do not implement an MSB AML program merely because this file exists.

First determine whether the business is in scope.

---

# 4. OFAC Sanctions

Sanctions analysis is separate from FinCEN registration.

OFAC has published virtual-currency-industry sanctions guidance.

Official source:

https://ofac.treasury.gov/recent-actions/20211015

For a global crypto product, counsel should determine:

```text
which sanctions regimes apply to DXJ Labs;
whether blocked-person screening is required;
whether geographic restrictions are appropriate;
what to do with a positive match;
whether smart-contract immutability changes response options.
```

---

# 5. Privacy Does Not Mean Sanctions Immunity

Do not market VINSS as:

```text
untraceable;
sanctions-proof;
compliance-proof;
impossible to block;
no identity ever needed.
```

Privacy should mean:

> private commercial context is not unnecessarily exposed to public observers.

That is compatible with lawful compliance requirements.

---

# 6. Risk-Based Controls to Evaluate

Depending on final legal classification:

```text
sanctions screening;
wallet risk screening;
country/IP restrictions;
high-risk jurisdiction controls;
transaction limits;
manual escalation;
suspicious-pattern monitoring;
recordkeeping;
customer due diligence;
enhanced due diligence;
Travel Rule implementation.
```

Not all controls are automatically required.

They should be activated based on jurisdiction, licence status, service model, and risk.

---

# 7. Privacy-Preserving Compliance Design

Where controls are required, prefer designs that do not unnecessarily centralise deal content.

Possible pattern:

```text
screen public settlement identifiers
+
minimal user/account information
+
selective escalation
```

rather than:

```text
store every private Message in plaintext.
```

---

# 8. Resolver / Dispute Abuse

A dispute system may itself be abused for:

```text
fraud;
collusion;
wash settlements;
sanctions evasion;
false evidence.
```

Log:

```text
case id;
public settlement reference;
resolver decision;
authorized split;
relevant compliance decision.
```

Do not log private content beyond what is necessary.

---

# 9. Loyalty / Token Farming

If Points later lead to token allocation, financial-crime controls may need to address:

```text
sybil accounts;
wash deals;
self-dealing;
circular funds;
fake referrals;
sanctioned-wallet farming.
```

Anti-farming is not only an economic issue.

---

# 10. Launch Gate

Before broad global launch, obtain an answer to:

```text
Which AML/sanctions obligations apply to the actual operating entity
for each jurisdiction actively targeted?
```

Then translate the answer into product controls.

Do not start with maximum surveillance by default.

Do not start with zero controls by assumption.

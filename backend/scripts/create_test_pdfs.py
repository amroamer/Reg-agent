"""Create sample regulatory PDFs for testing the ingestion pipeline."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fpdf import FPDF


def create_sama_pdf():
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 15, "SAMA Credit Card Rules", ln=True, align="C")
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 10, "Document Number: SAMA-BCR-2024-01", ln=True, align="C")
    pdf.cell(0, 10, "Effective Date: 2024-06-01", ln=True, align="C")
    pdf.ln(10)

    sections = [
        ("Chapter 1: General Provisions", [
            ("Article 1: Definitions",
             "Credit Card: A card issued by the Issuer that enables its holder to make purchases "
             "and cash withdrawals within the granted credit limit. The credit limit shall be "
             "determined based on the cardholder's creditworthiness and income assessment.\n\n"
             "Charge Card: A card issued by the Issuer that requires its holder to pay the full "
             "outstanding amount at the end of each billing cycle.\n\n"
             "Issuer: A bank or finance company licensed by the Saudi Central Bank (SAMA) to "
             "issue credit cards and charge cards within the Kingdom of Saudi Arabia."),
            ("Article 2: Scope of Application",
             "The provisions of these Rules shall apply to all banks and finance companies "
             "licensed by the Saudi Central Bank that issue credit cards or charge cards within "
             "the Kingdom of Saudi Arabia. These rules cover all aspects of credit card issuance, "
             "management, fees, consumer protection, and dispute resolution."),
        ]),
        ("Chapter 2: Card Issuance", [
            ("Article 3: Eligibility Requirements",
             "The Issuer shall not issue a credit card to any person unless the following "
             "conditions are met:\n"
             "1. The applicant must be at least 18 years of age.\n"
             "2. The applicant must have a valid national ID or residency permit.\n"
             "3. The Issuer must conduct a thorough credit assessment.\n"
             "4. The applicant's total debt service ratio shall not exceed 33% of monthly income.\n"
             "5. The Issuer must verify the applicant's employment and income."),
            ("Article 4: Credit Limit Assessment",
             "The maximum credit limit shall be determined based on the following:\n"
             "1. Monthly income verification through salary certificates or bank statements.\n"
             "2. Existing financial obligations including loans, mortgages, and other credit cards.\n"
             "3. Credit bureau report from SIMAH.\n"
             "4. The total credit limit across all cards shall not exceed 4 times monthly salary."),
        ]),
        ("Chapter 3: Fees and Charges", [
            ("Article 5: Permitted Fees",
             "The Issuer shall comply with the following maximum fee limits:\n"
             "- Annual Fee: Maximum SAR 500 per year\n"
             "- Late Payment Fee: Maximum SAR 100 per occurrence\n"
             "- Cash Advance Fee: Maximum 3% of amount (minimum SAR 75)\n"
             "- Foreign Transaction Fee: Maximum 2.5% of transaction amount\n"
             "- Replacement Card Fee: Maximum SAR 50\n\n"
             "The Issuer may not impose any fees or charges not listed in the approved schedule. "
             "All fees must be disclosed to the cardholder before card issuance."),
            ("Article 6: Interest Rate Caps",
             "The annual percentage rate (APR) on credit card balances shall not exceed the rate "
             "published by SAMA. The Issuer must clearly disclose the APR in the card agreement "
             "and on every monthly statement. Promotional rates must clearly state the duration "
             "and the rate that applies after the promotional period ends."),
        ]),
        ("Chapter 4: Consumer Protection", [
            ("Article 7: Disclosure Requirements",
             "The Issuer must provide the following disclosures before issuing a credit card:\n"
             "1. Complete terms and conditions in Arabic.\n"
             "2. Fee schedule with all applicable charges.\n"
             "3. APR and method of calculating interest.\n"
             "4. Minimum payment amount and its calculation method.\n"
             "5. Grace period duration.\n"
             "6. Liability limits for unauthorized transactions.\n"
             "7. Dispute resolution procedures and timeframes."),
            ("Article 8: Dispute Resolution",
             "The Issuer must establish a clear dispute resolution process:\n"
             "1. Acknowledge receipt of dispute within 2 business days.\n"
             "2. Investigate and respond within 10 business days.\n"
             "3. Provide provisional credit for disputed amounts over SAR 500.\n"
             "4. If the dispute is not resolved, the cardholder may escalate to SAMA.\n"
             "5. The Issuer must maintain records of all disputes for 5 years."),
        ]),
    ]

    for chapter_title, articles in sections:
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 12, chapter_title, ln=True)
        pdf.ln(3)
        for article_title, content in articles:
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(0, 10, article_title, ln=True)
            pdf.set_font("Helvetica", "", 10)
            pdf.multi_cell(0, 6, content)
            pdf.ln(5)

    path = "../documents/sama/sama-credit-card-rules-2024.pdf"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pdf.output(path)
    print(f"Created: {path}")
    return path


def create_cma_pdf():
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 15, "CMA Market Conduct Regulations", ln=True, align="C")
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 10, "Document Number: CMA-MC-2024-05", ln=True, align="C")
    pdf.cell(0, 10, "Effective Date: 2024-09-01", ln=True, align="C")
    pdf.ln(10)

    sections = [
        ("Article 1: Purpose and Scope",
         "These regulations aim to maintain fair, transparent, and efficient capital markets "
         "in the Kingdom of Saudi Arabia. They apply to all authorized persons, listed companies, "
         "and market participants under CMA jurisdiction."),
        ("Article 2: Market Manipulation Prohibition",
         "No person shall engage in market manipulation, which includes:\n"
         "1. Creating a false or misleading impression of trading activity.\n"
         "2. Artificially affecting the price of a security.\n"
         "3. Wash trading or matched orders.\n"
         "4. Spreading false information to influence market prices.\n"
         "5. Front-running client orders.\n\n"
         "Violations may result in fines up to SAR 10,000,000 and imprisonment."),
        ("Article 3: Insider Trading",
         "Insider trading is strictly prohibited. An insider shall not:\n"
         "1. Trade in securities based on material non-public information.\n"
         "2. Disclose material non-public information to any person.\n"
         "3. Recommend trading based on inside information.\n\n"
         "Insiders include directors, officers, employees, and any person with access to "
         "material non-public information by virtue of their position or relationship."),
        ("Article 4: Disclosure and Transparency",
         "Listed companies must disclose material information promptly to the market. "
         "Material information includes:\n"
         "1. Financial results and forecasts.\n"
         "2. Changes in board or executive management.\n"
         "3. Mergers, acquisitions, or disposals.\n"
         "4. Significant contracts or legal proceedings.\n"
         "5. Changes in capital structure or dividend policy."),
        ("Article 5: Consumer Protection in Securities",
         "Authorized persons must ensure fair treatment of clients:\n"
         "1. Suitability assessment before recommending investments.\n"
         "2. Clear disclosure of risks and fees.\n"
         "3. Best execution of client orders.\n"
         "4. Segregation of client assets.\n"
         "5. Complaint handling within 5 business days."),
    ]

    for title, content in sections:
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 10, title, ln=True)
        pdf.set_font("Helvetica", "", 10)
        pdf.multi_cell(0, 6, content)
        pdf.ln(5)

    path = "../documents/cma/cma-market-conduct-2024.pdf"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pdf.output(path)
    print(f"Created: {path}")
    return path


def create_bank_policy_pdf():
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 15, "Internal AML/KYC Policy", ln=True, align="C")
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 10, "Policy Number: BP-AML-003", ln=True, align="C")
    pdf.cell(0, 10, "Version: 3.0 | Effective: 2024-03-01", ln=True, align="C")
    pdf.ln(10)

    sections = [
        ("Section 1: Policy Objective",
         "This policy establishes the bank's framework for Anti-Money Laundering (AML) and "
         "Know Your Customer (KYC) compliance in accordance with SAMA AML Guidelines and "
         "the Anti-Money Laundering Law issued by Royal Decree. The bank is committed to "
         "preventing its services from being used for money laundering or terrorist financing."),
        ("Section 2: Customer Due Diligence",
         "The bank must perform Customer Due Diligence (CDD) for all customers:\n"
         "1. Verify identity using government-issued documents.\n"
         "2. Verify beneficial ownership for corporate customers.\n"
         "3. Understand the nature and purpose of the business relationship.\n"
         "4. Conduct ongoing monitoring of transactions.\n"
         "5. Apply Enhanced Due Diligence (EDD) for high-risk customers including:\n"
         "   - Politically Exposed Persons (PEPs)\n"
         "   - Customers from high-risk jurisdictions\n"
         "   - Complex ownership structures\n"
         "   - Unusually large transactions"),
        ("Section 3: Transaction Monitoring",
         "The bank must implement automated transaction monitoring systems that:\n"
         "1. Flag transactions exceeding SAR 60,000 for individual reporting.\n"
         "2. Detect structuring patterns (multiple transactions below threshold).\n"
         "3. Monitor cross-border wire transfers.\n"
         "4. Flag transactions with sanctioned countries or entities.\n"
         "5. Generate Suspicious Activity Reports (SARs) within 24 hours.\n\n"
         "All SARs must be filed with the Saudi Financial Intelligence Unit (SAFIU)."),
        ("Section 4: Record Keeping",
         "The bank must maintain the following records for a minimum of 10 years:\n"
         "1. Customer identification documents and CDD records.\n"
         "2. Transaction records including dates, amounts, and parties.\n"
         "3. Suspicious Activity Reports and investigation files.\n"
         "4. Training records for all employees.\n"
         "5. Internal audit reports related to AML compliance."),
        ("Section 5: Staff Training",
         "All employees must complete AML/KYC training:\n"
         "1. New employees: within 30 days of joining.\n"
         "2. All staff: annual refresher training.\n"
         "3. Compliance team: quarterly advanced training.\n"
         "4. Board members: annual awareness session.\n\n"
         "This policy implements SAMA Circular No. SAMA-AML-2023-07 regarding enhanced "
         "customer due diligence requirements for banks operating in Saudi Arabia."),
    ]

    for title, content in sections:
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 10, title, ln=True)
        pdf.set_font("Helvetica", "", 10)
        pdf.multi_cell(0, 6, content)
        pdf.ln(5)

    path = "../documents/bank_policies/aml-kyc-policy-v3.pdf"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pdf.output(path)
    print(f"Created: {path}")
    return path


if __name__ == "__main__":
    print("Creating test regulatory PDFs...\n")
    sama = create_sama_pdf()
    cma = create_cma_pdf()
    bank = create_bank_policy_pdf()
    print(f"\nDone! 3 test PDFs created.")
    print(f"\nTo ingest them, run:")
    print(f'  python scripts/ingest_pdf.py {sama} --source SAMA --title-en "SAMA Credit Card Rules 2024" --doc-number "SAMA-BCR-2024-01"')
    print(f'  python scripts/ingest_pdf.py {cma} --source CMA --title-en "CMA Market Conduct Regulations" --doc-number "CMA-MC-2024-05"')
    print(f'  python scripts/ingest_pdf.py {bank} --source BANK_POLICY --title-en "AML/KYC Policy v3" --doc-number "BP-AML-003"')

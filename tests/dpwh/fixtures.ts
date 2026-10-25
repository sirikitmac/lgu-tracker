/**
 * Source-row fixtures. `realRow` is contract 20N00065 exactly as decoded from
 * dpwh_transparency_data_all_details.parquet at revision 9617fe68 (bidders
 * omitted, as the sync does not read them). The other helpers derive
 * deliberately malformed variants for tests; they are not real records.
 */
export const realRow: Record<string, unknown> = {
  contractId: '20N00065',
  description: 'RECONSTRUCTION OF DAMAGED SEAWALL ALONG BRGY. PUNTA, NASIPIT, AGUSAN DEL NORTE',
  category: 'Flood Control and Drainage',
  status: 'Completed',
  budget: 102874773.39,
  amountPaid: BigInt(0),
  progress: 100,
  region: 'Region XIII',
  province: 'Region XIII',
  infraType: 'Flood Control and Drainage',
  latitude: 8.9909486,
  longitude: 125.3476496,
  contractor: 'MAMSAR CONSTRUCTION AND INDUSTRIAL CORPORATION (15885)',
  startDate: new Date('2020-03-25T00:00:00.000Z'),
  completionDate: new Date('2021-03-22T00:00:00.000Z'),
  infraYear: '2020',
  contractEffectivityDate: new Date('2020-03-25T00:00:00.000Z'),
  expiryDate: new Date('2021-03-22T00:00:00.000Z'),
  programName: 'Regular Infra',
  sourceOfFunds: 'Regular Infra - GAA 2020 OO-2',
  isVerifiedByDpwh: false,
  isVerifiedByPublic: false,
  isLive: false,
  livestreamUrl: null,
  components: [
    {
      componentId: 'P00420423MN-CW1',
      description: 'Construction of Flood Mitigation Structure - Reconstruction of Damaged Seawall along Brgy. Punta, Nasipit, Agusan del Norte',
      infraType: 'Flood Control and Drainage',
      typeOfWork: 'Construction of Flood Mitigation Structure',
      region: 'Region XIII',
      province: 'AGUSAN DEL NORTE',
      coordinates: { latitude: 8.9909486, longitude: 125.3476496, source: 'infra_track', locationVerified: false },
    },
  ],
  winnerNames: 'MAMSAR CONSTRUCTION AND INDUSTRIAL CORPORATION',
  contractName: 'RECONSTRUCTION OF DAMAGED SEAWALL ALONG BRGY. PUNTA, NASIPIT, AGUSAN DEL NORTE',
  abc: '102874773.39',
  status_1: 'F',
  fundingInstrument: 'GOP-GOVERNMENT OF THE PHILIPPINES',
  advertisementDate: '2019-12-10 00:00:00.0000000',
  bidSubmissionDeadline: '2020-01-06 00:00:00.0000000',
  dateOfAward: '2020-02-17 00:00:00.0000000',
  awardAmount: '102,410,000.00',
  advertisement: null,
  contractAgreement: 'https://dcs.infrawatch.ph/contract_agreement/20N00065/contract.pdf',
  noticeOfAward: null,
  noticeToProceed: null,
  totalImages: BigInt(12),
  latestImageDate: '2021-03-01 10:00:00.000000',
};

/** A synthetic row with a given ID, derived from realRow (test-only). */
export function rowWithId(contractId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...realRow, contractId, ...overrides };
}

export const revision = {
  sha: '9617fe6833de522e7151947b2ca7529a4e46273c',
  committedAt: '2026-01-16T12:10:57.000Z',
  fileUrl: 'https://huggingface.co/datasets/bettergovph/dpwh-transparency-data/resolve/9617fe6833de522e7151947b2ca7529a4e46273c/dpwh_transparency_data_all_details.parquet',
};

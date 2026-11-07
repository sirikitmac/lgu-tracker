import type { Comment, Post } from './types';

/*
 * Sample discussions. Project links go to the directory's search, because the
 * stories are made up and name no real contract.
 */
const search = (q: string) => `/projects?q=${encodeURIComponent(q)}`;

export const MOCK_POSTS: Post[] = [
  {
    id: 'p-tambo-road',
    authorId: 'maricel',
    title: 'Bitak na naman ang kalsada sa amin, kasama ba ito sa project na nakalista?',
    body:
      'Mga kababayan, kakatapos lang ng concreting sa kalsada namin noong Hunyo pero may mga bitak na agad ngayong Oktubre. Tiningnan ko sa Bantay Proyekto at may nakalistang road concreting project sa barangay namin na "completed" na.\n\nSino pa ang may ganitong karanasan? Gusto kong malaman kung paano ito dapat i-report nang maayos bago kami magsulat sa munisipyo.',
    createdAt: '2026-11-06T22:14:00+08:00',
    score: 42,
    project: { title: 'Road concreting, Barangay Tambo', href: search('road concreting Tambo') },
  },
  {
    id: 'p-flood-check',
    authorId: 'angelica',
    title: 'How do you tell if a flood control project is actually finished?',
    body:
      "I'm researching flood control spending in my area. The directory shows a project as completed, but the site visits I made told a different story: some drainage covers are missing and one outfall is still unfinished.\n\nHow do you cross-check the status shown here against what you see on the ground? Photos, dates, the contractor's name? I'd like to learn how others do it before I file anything.",
    createdAt: '2026-11-06T09:40:00+08:00',
    score: 67,
    project: { title: 'Flood control and drainage works', href: search('flood control drainage') },
  },
  {
    id: 'p-use-code',
    authorId: 'ramon',
    title: 'Tip mula sa loob: laging ilagay ang project code kapag magre-report',
    body:
      'Bilang government employee na nagbabasa ng mga report, ito ang pinakamalaking tulong: ilagay ang project code, ang petsa kung kailan mo nakita, at kung saan eksakto (kalye o landmark).\n\nMas mabilis ma-trace ang report kapag kumpleto ang tatlong iyan. Kung may litrato, mas mabuti. Pero huwag isama ang phone number o ID, at iwasan ang paratang sa mga taong may pangalan. Ilarawan lang ang nakita mo.',
    createdAt: '2026-11-05T17:05:00+08:00',
    score: 118,
  },
  {
    id: 'p-school-bldg',
    authorId: 'junjun',
    title: 'Mga school building projects sa Region X: sulit bang bisitahin ang mga completed?',
    body:
      'For our thesis, we are comparing school building projects marked completed against their posted dates. Plan namin na bumisita sa ilang site this month.\n\nAnyone here from a school or PTA who has seen how these projects turned out? Ang gusto naming malaman ay kung ginagamit na ba talaga ang mga classroom, hindi lang kung natapos on paper.',
    createdAt: '2026-11-05T11:22:00+08:00',
    score: 31,
    project: { title: 'School building construction', href: search('school building') },
  },
  {
    id: 'p-no-delay',
    authorId: 'carlo',
    title: 'Dalawang buwan nang nakatigil ang trabaho sa tulay, ano ang pwedeng gawin?',
    body:
      'Araw-araw akong dumadaan sa tulay na ginagawa. Mula pa Setyembre, wala nang nagtatrabaho at nakaharang pa rin ang mga bakal. Kailangan naming umikot ng halos dalawang kilometro.\n\nPwede ko bang i-report ito dito kahit hindi ako taga-barangay na iyon? Ako lang ba ang nakakapansin?',
    createdAt: '2026-11-04T19:48:00+08:00',
    score: 54,
    project: { title: 'Bridge construction, stalled', href: search('bridge construction') },
  },
  {
    id: 'p-variance',
    authorId: 'trisha',
    title: 'Bakit minsan iba ang contract amount sa approved budget? (newbie question)',
    body:
      'IT student here, still learning how to read the numbers. I noticed some projects show a contract amount lower than the approved budget for the contract.\n\nIs that normal? Savings from bidding, or does it mean something is off? Salamat in advance sa mga makakasagot!',
    createdAt: '2026-11-04T13:30:00+08:00',
    score: 23,
  },
  {
    id: 'p-thanks',
    authorId: 'lorna',
    title: 'Salamat, naayos na ang drainage sa aming kalye',
    body:
      'Gusto ko lang ibahagi: nag-report ako dito noong Setyembre tungkol sa barado at sirang drainage sa tapat ng paaralan. Nakatanggap ako ng update sa inbox na na-review na, at noong isang linggo ay may mga tao nang nag-aayos.\n\nHindi ko alam kung dahil sa report ko, pero masarap sa pakiramdam na may nakikinig. Maraming salamat sa mga nagbabantay!',
    createdAt: '2026-11-03T08:15:00+08:00',
    score: 89,
  },
  {
    id: 'p-notify',
    authorId: 'jessa',
    title: 'Feature idea: abisuhan kami kapag nagbago ang status ng project malapit sa amin',
    body:
      'It would help if we could follow a project and get notified when its status changes, say from ongoing to completed. As a nurse with irregular shifts, hindi ko laging nabubuksan ang site araw-araw.\n\nMay iba pa bang may gustong ganito? Kung marami tayo, baka mapag-isipan ng team.',
    createdAt: '2026-11-02T20:02:00+08:00',
    score: 36,
  },
];

export const MOCK_COMMENTS: Comment[] = [
  // p-tambo-road
  { id: 'c1', postId: 'p-tambo-road', parentId: null, authorId: 'ramon', body: 'Ma\'am Maricel, i-report po ninyo sa pamamagitan ng "Report a concern" sa project page. Ilagay ang petsa kung kailan ninyo unang nakita ang bitak at ang eksaktong lugar. Mas madaling suriin ng LGU kapag malinaw.', createdAt: '2026-11-06T22:50:00+08:00', score: 28 },
  { id: 'c2', postId: 'p-tambo-road', parentId: 'c1', authorId: 'maricel', body: 'Maraming salamat po, Engr. Gagawin ko ngayong gabi. May litrato rin akong nakuha noong Biyernes.', createdAt: '2026-11-06T23:05:00+08:00', score: 9 },
  { id: 'c3', postId: 'p-tambo-road', parentId: null, authorId: 'carlo', body: 'Ganyan din sa amin sa Pampanga, Kap. Mas maganda kung marami kayong nagpapadala ng parehong report para mapansin.', createdAt: '2026-11-06T23:20:00+08:00', score: 11 },
  { id: 'c4', postId: 'p-tambo-road', parentId: 'c3', authorId: 'junjun', body: 'Agree. Pero make sure each report describes what you personally saw, para hindi ito nagiging chismis lang. Mas mabigat ang specific details.', createdAt: '2026-11-07T00:10:00+08:00', score: 15 },

  // p-flood-check
  { id: 'c5', postId: 'p-flood-check', parentId: null, authorId: 'junjun', body: 'What worked for us: compare the dates and status in the project page with dated photos from your visit. Take the same angle each time so changes are obvious. Don\'t rely on a single visit.', createdAt: '2026-11-06T10:15:00+08:00', score: 33 },
  { id: 'c6', postId: 'p-flood-check', parentId: 'c5', authorId: 'angelica', body: 'Helpful, thanks! Do you also note the project code in your notes? I keep losing track of which site is which.', createdAt: '2026-11-06T10:40:00+08:00', score: 6 },
  { id: 'c7', postId: 'p-flood-check', parentId: 'c6', authorId: 'junjun', body: 'Yes, the code under the project title. I write it at the top of every photo folder.', createdAt: '2026-11-06T11:02:00+08:00', score: 8 },
  { id: 'c8', postId: 'p-flood-check', parentId: null, authorId: 'rahman', body: 'Tandaan din na ang ipinapakita dito ay ayon sa pinanggalingang datos. Hindi ito beripikado ng LGU. Kaya mahalaga ang mga report ng mga tao sa lugar.', createdAt: '2026-11-06T12:30:00+08:00', score: 21 },

  // p-use-code
  { id: 'c9', postId: 'p-use-code', parentId: null, authorId: 'bong', body: 'Salamat sa tip, Engr. Ramon! Madalas akong makakita ng mga problema sa daan papunta sa tindahan ko, ngayon alam ko na kung ano ang isasama.', createdAt: '2026-11-05T18:00:00+08:00', score: 14 },
  { id: 'c10', postId: 'p-use-code', parentId: null, authorId: 'trisha', body: 'Good to know. Is there a limit to how many photos we can attach?', createdAt: '2026-11-05T18:45:00+08:00', score: 7 },
  { id: 'c11', postId: 'p-use-code', parentId: 'c10', authorId: 'ramon', body: 'Hanggang apat na litrato kada report. Piliin ang pinakamalinaw na mga anggulo.', createdAt: '2026-11-05T19:10:00+08:00', score: 12 },

  // p-school-bldg
  { id: 'c12', postId: 'p-school-bldg', parentId: null, authorId: 'lorna', body: 'Retired teacher here. Kapag bumisita kayo, makipag-usap sa principal o sa PTA president. Sila ang nakakaalam kung ginagamit na ang mga silid-aralan at kung may problema sa bubong o kuryente.', createdAt: '2026-11-05T13:00:00+08:00', score: 19 },
  { id: 'c13', postId: 'p-school-bldg', parentId: 'c12', authorId: 'junjun', body: 'Maraming salamat po, Ma\'am Lorna! Hihingi kami ng permiso sa school bago pumasok.', createdAt: '2026-11-05T13:20:00+08:00', score: 5 },

  // p-no-delay
  { id: 'c14', postId: 'p-no-delay', parentId: null, authorId: 'maricel', body: 'Pwede po kayong mag-report kahit hindi kayo taga-roon, basta ikaw mismo ang nakakita. Ilagay ang project code at ang petsa kung kailan huling may nagtrabaho.', createdAt: '2026-11-04T20:15:00+08:00', score: 22 },
  { id: 'c15', postId: 'p-no-delay', parentId: 'c14', authorId: 'carlo', body: 'Sige po, Kap. Susubukan ko ngayong weekend, kukuha ako ng litrato ng site.', createdAt: '2026-11-04T20:40:00+08:00', score: 4 },
  { id: 'c16', postId: 'p-no-delay', parentId: null, authorId: 'bong', body: 'Delay din sa amin sa Bacolod. Minsan sa panahon ng ulan lang, minsan dahil sa materyales. Kapag may nakita kayong dahilan sa site, isama na rin sa report.', createdAt: '2026-11-04T21:30:00+08:00', score: 10 },

  // p-variance
  { id: 'c17', postId: 'p-variance', parentId: null, authorId: 'ramon', body: 'Normal ito sa maraming kaso. Ang approved budget ay ang pinakamataas na pwedeng gastusin, at ang contract amount ay ang napagkasunduan pagkatapos ng bidding. Madalas mas mababa ito. Pero kung napakalaki ng agwat, magandang itanong kung bakit.', createdAt: '2026-11-04T14:10:00+08:00', score: 26 },
  { id: 'c18', postId: 'p-variance', parentId: 'c17', authorId: 'trisha', body: 'Ah, kaya pala. Thank you! Naiintindihan ko na ngayon.', createdAt: '2026-11-04T14:25:00+08:00', score: 3 },
  { id: 'c19', postId: 'p-variance', parentId: null, authorId: 'angelica', body: 'Also keep in mind the page says values are shown as each source published them. If a figure looks off, it can simply be how it was recorded, so ask before assuming.', createdAt: '2026-11-04T15:00:00+08:00', score: 13 },

  // p-thanks
  { id: 'c20', postId: 'p-thanks', parentId: null, authorId: 'maricel', body: 'Ang ganda pong balita, Ma\'am Lorna! Ito ang gusto naming mangyari sa barangay namin.', createdAt: '2026-11-03T09:00:00+08:00', score: 12 },
  { id: 'c21', postId: 'p-thanks', parentId: null, authorId: 'rahman', body: 'Alhamdulillah. Nakakataba ng puso. Sana mas dumami pa ang mga ganitong kuwento.', createdAt: '2026-11-03T10:30:00+08:00', score: 9 },

  // p-notify
  { id: 'c22', postId: 'p-notify', parentId: null, authorId: 'trisha', body: '+1 dito. Kahit email lang or in-app notification, okay na.', createdAt: '2026-11-02T20:30:00+08:00', score: 15 },
  { id: 'c23', postId: 'p-notify', parentId: null, authorId: 'bong', body: 'Support! Pero sana optional lang, para hindi ma-spam ang inbox.', createdAt: '2026-11-02T21:10:00+08:00', score: 8 },
  { id: 'c24', postId: 'p-notify', parentId: 'c23', authorId: 'jessa', body: 'Agree, dapat may switch para ma-off.', createdAt: '2026-11-02T21:25:00+08:00', score: 4 },
];

/** The sample people's reviews of Bantay Proyekto for the landing page. Same people as the discussions. */
export interface Testimonial {
  profileId: string;
  lang: 'tl' | 'en';
  /** Stars, 1 to 5. A believable mix, not all fives. */
  rating: number;
  quote: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    profileId: 'maricel',
    rating: 5,
    lang: 'tl',
    quote: 'Dati kailangan pa naming pumunta sa munisipyo para malaman kung ano ang nangyari sa isang proyekto. Ngayon, nahahanap ko na sa telepono ko ang code, ang halaga at ang status. Malaking tulong ito sa mga tanong ng mga kabarangay.',
  },
  {
    profileId: 'angelica',
    rating: 4,
    lang: 'en',
    quote: 'As a reporter, the thing I trust most is that each figure shows where it came from. I can trace a project back to its source in a couple of clicks, and the page is honest about what has not been verified.',
  },
  {
    profileId: 'carlo',
    rating: 5,
    lang: 'tl',
    quote: 'Simple lang gamitin kahit hindi ako techie. Nag-report ako tungkol sa tulay na matagal nang hindi gumagalaw, at nakita ko sa inbox ko kung ano na ang nangyari sa report ko.',
  },
  {
    profileId: 'junjun',
    rating: 3,
    lang: 'en',
    quote: 'Useful for our thesis: filtering by region and project type is quick, and the numbers line up with the sources. Three stars for now because the map gets slow on my old phone, and many older projects still have no photos. Looking forward to improvements!',
  },
  {
    profileId: 'lorna',
    rating: 4,
    lang: 'tl',
    quote: 'Retirado na ako pero gusto ko pa ring may silbi. Dito, kahit ordinaryong mamamayan ay may boses. Natutuwa ako na may sumasagot at nag-aayos.',
  },
  {
    profileId: 'ramon',
    rating: 4,
    lang: 'en',
    quote: 'From the government side, complete reports with the project code and a clear location make my review much faster. It is a tidy way for residents and staff to talk about the same project.',
  },
];

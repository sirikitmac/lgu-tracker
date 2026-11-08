-- Generated from the preview's sample discussions (src/lib/community/mock.ts).
-- Fictional people and stories; ids are fixed so this is safe to read, not to rerun.

insert into public.community_posts (id, sample_author, title, body, project_title, project_href, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:post:p-tambo-road')::uuid, 'maricel', 'Bitak na naman ang kalsada sa amin, kasama ba ito sa project na nakalista?', 'Mga kababayan, kakatapos lang ng concreting sa kalsada namin noong Hunyo pero may mga bitak na agad ngayong Oktubre. Tiningnan ko sa Bantay Proyekto at may nakalistang road concreting project sa barangay namin na "completed" na.

Sino pa ang may ganitong karanasan? Gusto kong malaman kung paano ito dapat i-report nang maayos bago kami magsulat sa munisipyo.', 'Road concreting, Barangay Tambo', '/projects?q=road%20concreting%20Tambo', 'Maricel Dela Cruz', 42, 42, true, '2026-11-06T22:14:00+08:00');
insert into public.community_posts (id, sample_author, title, body, project_title, project_href, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:post:p-flood-check')::uuid, 'angelica', 'How do you tell if a flood control project is actually finished?', 'I''m researching flood control spending in my area. The directory shows a project as completed, but the site visits I made told a different story: some drainage covers are missing and one outfall is still unfinished.

How do you cross-check the status shown here against what you see on the ground? Photos, dates, the contractor''s name? I''d like to learn how others do it before I file anything.', 'Flood control and drainage works', '/projects?q=flood%20control%20drainage', 'Angelica Ramos', 67, 67, true, '2026-11-06T09:40:00+08:00');
insert into public.community_posts (id, sample_author, title, body, project_title, project_href, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:post:p-use-code')::uuid, 'ramon', 'Tip mula sa loob: laging ilagay ang project code kapag magre-report', 'Bilang government employee na nagbabasa ng mga report, ito ang pinakamalaking tulong: ilagay ang project code, ang petsa kung kailan mo nakita, at kung saan eksakto (kalye o landmark).

Mas mabilis ma-trace ang report kapag kumpleto ang tatlong iyan. Kung may litrato, mas mabuti. Pero huwag isama ang phone number o ID, at iwasan ang paratang sa mga taong may pangalan. Ilarawan lang ang nakita mo.', null, null, 'Engr. Ramon Sabalones', 118, 118, true, '2026-11-05T17:05:00+08:00');
insert into public.community_posts (id, sample_author, title, body, project_title, project_href, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:post:p-school-bldg')::uuid, 'junjun', 'Mga school building projects sa Region X: sulit bang bisitahin ang mga completed?', 'For our thesis, we are comparing school building projects marked completed against their posted dates. Plan namin na bumisita sa ilang site this month.

Anyone here from a school or PTA who has seen how these projects turned out? Ang gusto naming malaman ay kung ginagamit na ba talaga ang mga classroom, hindi lang kung natapos on paper.', 'School building construction', '/projects?q=school%20building', 'Jun-jun Villanueva', 31, 31, true, '2026-11-05T11:22:00+08:00');
insert into public.community_posts (id, sample_author, title, body, project_title, project_href, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:post:p-no-delay')::uuid, 'carlo', 'Dalawang buwan nang nakatigil ang trabaho sa tulay, ano ang pwedeng gawin?', 'Araw-araw akong dumadaan sa tulay na ginagawa. Mula pa Setyembre, wala nang nagtatrabaho at nakaharang pa rin ang mga bakal. Kailangan naming umikot ng halos dalawang kilometro.

Pwede ko bang i-report ito dito kahit hindi ako taga-barangay na iyon? Ako lang ba ang nakakapansin?', 'Bridge construction, stalled', '/projects?q=bridge%20construction', 'Carlo Mendoza', 54, 54, true, '2026-11-04T19:48:00+08:00');
insert into public.community_posts (id, sample_author, title, body, project_title, project_href, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:post:p-variance')::uuid, 'trisha', 'Bakit minsan iba ang contract amount sa approved budget? (newbie question)', 'IT student here, still learning how to read the numbers. I noticed some projects show a contract amount lower than the approved budget for the contract.

Is that normal? Savings from bidding, or does it mean something is off? Salamat in advance sa mga makakasagot!', null, null, 'Trisha Ocampo', 23, 23, true, '2026-11-04T13:30:00+08:00');
insert into public.community_posts (id, sample_author, title, body, project_title, project_href, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:post:p-thanks')::uuid, 'lorna', 'Salamat, naayos na ang drainage sa aming kalye', 'Gusto ko lang ibahagi: nag-report ako dito noong Setyembre tungkol sa barado at sirang drainage sa tapat ng paaralan. Nakatanggap ako ng update sa inbox na na-review na, at noong isang linggo ay may mga tao nang nag-aayos.

Hindi ko alam kung dahil sa report ko, pero masarap sa pakiramdam na may nakikinig. Maraming salamat sa mga nagbabantay!', null, null, 'Lorna Baluyot', 89, 89, true, '2026-11-03T08:15:00+08:00');
insert into public.community_posts (id, sample_author, title, body, project_title, project_href, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:post:p-notify')::uuid, 'jessa', 'Feature idea: abisuhan kami kapag nagbago ang status ng project malapit sa amin', 'It would help if we could follow a project and get notified when its status changes, say from ongoing to completed. As a nurse with irregular shifts, hindi ko laging nabubuksan ang site araw-araw.

May iba pa bang may gustong ganito? Kung marami tayo, baka mapag-isipan ng team.', null, null, 'Jessa Marie Tolentino', 36, 36, true, '2026-11-02T20:02:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c1')::uuid, md5('community-sample:post:p-tambo-road')::uuid, null, 'ramon', 'Ma''am Maricel, i-report po ninyo sa pamamagitan ng "Report a concern" sa project page. Ilagay ang petsa kung kailan ninyo unang nakita ang bitak at ang eksaktong lugar. Mas madaling suriin ng LGU kapag malinaw.', 'Engr. Ramon Sabalones', 28, 28, true, '2026-11-06T22:50:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c2')::uuid, md5('community-sample:post:p-tambo-road')::uuid, md5('community-sample:comment:c1')::uuid, 'maricel', 'Maraming salamat po, Engr. Gagawin ko ngayong gabi. May litrato rin akong nakuha noong Biyernes.', 'Maricel Dela Cruz', 9, 9, true, '2026-11-06T23:05:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c3')::uuid, md5('community-sample:post:p-tambo-road')::uuid, null, 'carlo', 'Ganyan din sa amin sa Pampanga, Kap. Mas maganda kung marami kayong nagpapadala ng parehong report para mapansin.', 'Carlo Mendoza', 11, 11, true, '2026-11-06T23:20:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c4')::uuid, md5('community-sample:post:p-tambo-road')::uuid, md5('community-sample:comment:c3')::uuid, 'junjun', 'Agree. Pero make sure each report describes what you personally saw, para hindi ito nagiging chismis lang. Mas mabigat ang specific details.', 'Jun-jun Villanueva', 15, 15, true, '2026-11-07T00:10:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c5')::uuid, md5('community-sample:post:p-flood-check')::uuid, null, 'junjun', 'What worked for us: compare the dates and status in the project page with dated photos from your visit. Take the same angle each time so changes are obvious. Don''t rely on a single visit.', 'Jun-jun Villanueva', 33, 33, true, '2026-11-06T10:15:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c6')::uuid, md5('community-sample:post:p-flood-check')::uuid, md5('community-sample:comment:c5')::uuid, 'angelica', 'Helpful, thanks! Do you also note the project code in your notes? I keep losing track of which site is which.', 'Angelica Ramos', 6, 6, true, '2026-11-06T10:40:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c7')::uuid, md5('community-sample:post:p-flood-check')::uuid, md5('community-sample:comment:c6')::uuid, 'junjun', 'Yes, the code under the project title. I write it at the top of every photo folder.', 'Jun-jun Villanueva', 8, 8, true, '2026-11-06T11:02:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c8')::uuid, md5('community-sample:post:p-flood-check')::uuid, null, 'rahman', 'Tandaan din na ang ipinapakita dito ay ayon sa pinanggalingang datos. Hindi ito beripikado ng LGU. Kaya mahalaga ang mga report ng mga tao sa lugar.', 'Rahman Macaraya', 21, 21, true, '2026-11-06T12:30:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c9')::uuid, md5('community-sample:post:p-use-code')::uuid, null, 'bong', 'Salamat sa tip, Engr. Ramon! Madalas akong makakita ng mga problema sa daan papunta sa tindahan ko, ngayon alam ko na kung ano ang isasama.', 'Bong Aguilar', 14, 14, true, '2026-11-05T18:00:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c10')::uuid, md5('community-sample:post:p-use-code')::uuid, null, 'trisha', 'Good to know. Is there a limit to how many photos we can attach?', 'Trisha Ocampo', 7, 7, true, '2026-11-05T18:45:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c11')::uuid, md5('community-sample:post:p-use-code')::uuid, md5('community-sample:comment:c10')::uuid, 'ramon', 'Hanggang apat na litrato kada report. Piliin ang pinakamalinaw na mga anggulo.', 'Engr. Ramon Sabalones', 12, 12, true, '2026-11-05T19:10:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c12')::uuid, md5('community-sample:post:p-school-bldg')::uuid, null, 'lorna', 'Retired teacher here. Kapag bumisita kayo, makipag-usap sa principal o sa PTA president. Sila ang nakakaalam kung ginagamit na ang mga silid-aralan at kung may problema sa bubong o kuryente.', 'Lorna Baluyot', 19, 19, true, '2026-11-05T13:00:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c13')::uuid, md5('community-sample:post:p-school-bldg')::uuid, md5('community-sample:comment:c12')::uuid, 'junjun', 'Maraming salamat po, Ma''am Lorna! Hihingi kami ng permiso sa school bago pumasok.', 'Jun-jun Villanueva', 5, 5, true, '2026-11-05T13:20:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c14')::uuid, md5('community-sample:post:p-no-delay')::uuid, null, 'maricel', 'Pwede po kayong mag-report kahit hindi kayo taga-roon, basta ikaw mismo ang nakakita. Ilagay ang project code at ang petsa kung kailan huling may nagtrabaho.', 'Maricel Dela Cruz', 22, 22, true, '2026-11-04T20:15:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c15')::uuid, md5('community-sample:post:p-no-delay')::uuid, md5('community-sample:comment:c14')::uuid, 'carlo', 'Sige po, Kap. Susubukan ko ngayong weekend, kukuha ako ng litrato ng site.', 'Carlo Mendoza', 4, 4, true, '2026-11-04T20:40:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c16')::uuid, md5('community-sample:post:p-no-delay')::uuid, null, 'bong', 'Delay din sa amin sa Bacolod. Minsan sa panahon ng ulan lang, minsan dahil sa materyales. Kapag may nakita kayong dahilan sa site, isama na rin sa report.', 'Bong Aguilar', 10, 10, true, '2026-11-04T21:30:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c17')::uuid, md5('community-sample:post:p-variance')::uuid, null, 'ramon', 'Normal ito sa maraming kaso. Ang approved budget ay ang pinakamataas na pwedeng gastusin, at ang contract amount ay ang napagkasunduan pagkatapos ng bidding. Madalas mas mababa ito. Pero kung napakalaki ng agwat, magandang itanong kung bakit.', 'Engr. Ramon Sabalones', 26, 26, true, '2026-11-04T14:10:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c18')::uuid, md5('community-sample:post:p-variance')::uuid, md5('community-sample:comment:c17')::uuid, 'trisha', 'Ah, kaya pala. Thank you! Naiintindihan ko na ngayon.', 'Trisha Ocampo', 3, 3, true, '2026-11-04T14:25:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c19')::uuid, md5('community-sample:post:p-variance')::uuid, null, 'angelica', 'Also keep in mind the page says values are shown as each source published them. If a figure looks off, it can simply be how it was recorded, so ask before assuming.', 'Angelica Ramos', 13, 13, true, '2026-11-04T15:00:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c20')::uuid, md5('community-sample:post:p-thanks')::uuid, null, 'maricel', 'Ang ganda pong balita, Ma''am Lorna! Ito ang gusto naming mangyari sa barangay namin.', 'Maricel Dela Cruz', 12, 12, true, '2026-11-03T09:00:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c21')::uuid, md5('community-sample:post:p-thanks')::uuid, null, 'rahman', 'Alhamdulillah. Nakakataba ng puso. Sana mas dumami pa ang mga ganitong kuwento.', 'Rahman Macaraya', 9, 9, true, '2026-11-03T10:30:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c22')::uuid, md5('community-sample:post:p-notify')::uuid, null, 'trisha', '+1 dito. Kahit email lang or in-app notification, okay na.', 'Trisha Ocampo', 15, 15, true, '2026-11-02T20:30:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c23')::uuid, md5('community-sample:post:p-notify')::uuid, null, 'bong', 'Support! Pero sana optional lang, para hindi ma-spam ang inbox.', 'Bong Aguilar', 8, 8, true, '2026-11-02T21:10:00+08:00');
insert into public.community_comments (id, post_id, parent_id, sample_author, body, author_name, base_score, score, is_sample, created_at)
values (md5('community-sample:comment:c24')::uuid, md5('community-sample:post:p-notify')::uuid, md5('community-sample:comment:c23')::uuid, 'jessa', 'Agree, dapat may switch para ma-off.', 'Jessa Marie Tolentino', 4, 4, true, '2026-11-02T21:25:00+08:00');

-- The comment triggers ran above; make sure the totals are right.
update public.community_posts p set comment_count = (select count(*) from public.community_comments c where c.post_id = p.id) where p.is_sample;

I've completed the research. Here is the full analysis.

---

# GDPR analysis — "Crawl Price Index" (Luxembourg), as at 20 August 2026

**Not legal advice.** I am not a lawyer and this is not legal advice. It is research against primary sources, for you to take to a Luxembourg data protection lawyer. Where I could not verify a paragraph number verbatim (EUR-Lex and InfoCuria repeatedly served cached/wrong documents through the proxy), I flag it.

**Currency check performed.** Everything below is checked against sources dated to August 2026. Two things have moved since most commentary you'll find:

- **EDPS v SRB, C-413/23 P, judgment 4 September 2025** — the CJEU's most recent word on identifiability. It refines Breyer.
- **The Digital Omnibus (COM proposal, 19 November 2025)** would narrow the Art 4(1) definition of personal data and add an Art 9 carve-out. **It is not law.** The Cyprus Presidency withdrew its compromise text on 30 June 2026 after failing to reach a qualified majority; the Irish Presidency took over on 1 July 2026. The EDPB and EDPS jointly opposed the personal-data definition change in [Joint Opinion 2/2026 (10 February 2026)](https://www.edpb.europa.eu/system/files/2026-02/edpb_edps_jointopinion_202602_digitalomnibus_en.pdf). **Do not design around it.**

---

## 1. When is a domain name + derived label personal data?

### The test

**Art 4(1) GDPR**: "any information relating to an identified or identifiable natural person". Three limbs: *any information* → *relating to* → *identifiable natural person*.

**"Any information" is deliberately wide.** *Nowak*, C-434/16 (20 Dec 2017), para 34: the expression "any information … reflects the aim of the EU legislature to assign a wide scope to that concept, which is not restricted to information that is sensitive or private, but potentially encompasses all kinds of information, not only objective but also subjective, in the form of opinions and assessments, provided that it 'relates' to the data subject." **A derived label is squarely covered** — subjective assessments count.

**"Relating to" — the content / purpose / effect test.** *Nowak* para 35: satisfied "where the information, by reason of its content, purpose or effect, is linked to a particular person." These are **alternatives, not cumulative**. The [Art 29 WP Opinion 4/2007 (WP136)](https://ec.europa.eu/justice/article-29/documentation/opinion-recommendation/files/2007/wp136_en.pdf) elaborates the three elements and — critically for you — addresses data about *objects*:

> "Those objects usually belong to someone, or may be subject to particular influence by or upon individuals … It is then only indirectly that it can be considered that the information relates to those individuals."

WP136's worked examples are a car and a house. **A domain name is exactly that kind of object.** So the "it's about a website, not a person" framing is a recognised argument — but WP136 is explicit that it does not end the analysis; it just means the link is *indirect*.

**Identifiability.** Recital 26: account should be taken of "all the means reasonably likely to be used, such as singling out, either by the controller or by another person to identify the natural person directly or indirectly", considering objective factors including cost, time and available technology.

- *Breyer*, C-582/14 (19 Oct 2016): the identifying elements need **not** all be in one person's hands; what matters is whether a lawful and practically feasible route to identification exists. (I could not re-fetch the judgment text this session; the operative holding is well established.)
- **EDPS v SRB, C-413/23 P (4 Sept 2025)** — the important recent case, decided under Regulation 2018/1725 (Art 3(1) and Recital 16 being the EUDPR twins of Art 4(1) and Recital 26 GDPR). Key holdings, per the [Court's press release](https://curia.europa.eu/site/upload/docs/application/pdf/2025-09/cp250107en.pdf) and judgment:
  - The test is **relative and contextual, not absolute**: "the relevant perspective for assessing whether the data subject is identifiable depends, in essence, on the circumstances of the processing of the data in each individual case" (~para 100).
  - "Pseudonymisation may, depending on the circumstances of the case, effectively prevent persons other than the controller from identifying the data subject."
  - But for **information obligations**, identifiability is assessed **at the time of collection and from the controller's point of view**, irrespective of the recipient's position (~para 111).
  - The Court set aside the General Court's judgment and referred the case back.

**What EDPS v SRB means for a publisher — and it is not what most people hope.** The relative test helps *recipients* of stripped data. It does **not** help you, for two reasons. First, your obligations (including Art 14) are assessed from *your* viewpoint at collection. Second, your recipients are subscribers who can identify the person by the trivial expedient of typing the domain into a browser. There is no version of this dataset in which the identifying key is withheld — **the domain name *is* the primary key of the product**. You cannot pseudonymise your way out.

### Sole traders, freelancers, personal blogs

**Yes — personal data.** Authority:

- ***Schecke and Eifert*, C-92/09 and C-93/09 (9 Nov 2010), para 59**: "it is of no relevance in this respect that the data published concerns activities of a professional nature." The Court expressly rejected the argument that professional/business data attracts lesser protection, citing ECtHR case law that "private life" must not be read to exclude business activity. Paras 58–59 also hold that **publishing names on the internet, accessible to an unlimited number of people, is itself a serious interference** with Arts 7 and 8 of the Charter.
- **Schecke para 53**: a *legal person* can invoke the protection "in so far as the official title of the legal person identifies one or more natural persons" — the partnership "Volker und Markus Schecke GbR" qualified. **This directly catches eponymous micro-companies**: `smith-and-sons.lu`, `mueller-consulting.de`, `cabinet-dupont.fr`.
- **ICO**, [What is personal data](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/personal-information-what-is-it/what-is-personal-data/what-is-personal-data/): "The UK GDPR does apply to personal data relating to individuals acting as sole traders, employees, partners, and company directors." Information about *legal entities themselves* is outside scope (GDPR Recital 14 to the same effect).
- **Bisnode** (Poland) — the Warsaw Regional Administrative Court (11 Dec 2019) upheld the DPA's position that **Art 14 obligations apply to sole traders** carrying on business, and to those with temporarily suspended activity; only genuinely ceased sole traders were excluded. See [IAPP](https://iapp.org/news/a/polish-court-overturns-dpas-first-gdpr-fine).
- **EDPB/ICANN, WHOIS (13 July 2018)**: the EDPB accepted that *generic* contact data (`info@company.com`) may lawfully be published, but data identifying individual employees or persons acting for a registrant should not be published by default. See [ICANN](https://www.icann.org/en/blogs/details/data-protectionprivacy-update-additional-guidance-from-the-european-data-protection-board-13-7-2018-en). The natural/legal person distinction is real, but it cuts *for* protection of individual registrants.

### Conclusion on Q1

For a material minority of your 50,000 rows, **the row is personal data — this is not a close question.** Applying *Nowak*:
- **Content**: `johnsmithphotography.com` + `site_category: entertainment` tells you about John Smith's occupation.
- **Purpose**: the labels exist to classify and evaluate the site (and hence its operator's publishing posture).
- **Effect**: the labels are redistributed commercially and are liable to affect the person's interests — most obviously the adult flag.

Also note: your "small percentage" estimate is probably low. Once you add eponymous sole-trader companies (Schecke para 53) and personal-brand professional sites, a realistic figure for a top-50k list is **5–15% of rows**, i.e. **2,500–7,500 data subjects**, refreshed weekly and accumulating a time series. That number matters for the DPIA "large scale" criterion (§5 below).

**What is genuinely out of scope**: rows for real corporates, public bodies, and generic-brand domains. Roughly 85–95% of your product. GDPR does not apply to them at all. **This is a mixed dataset problem, not a whole-product problem.**

---

## 2. Lawful basis — Art 6(1)(f)

### Status of the EDPB guidelines

**[Guidelines 1/2024 on processing of personal data based on Article 6(1)(f) GDPR](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202401_legitimateinterest_en.pdf)**, **Version 1.0, adopted 8 October 2024**, marked "Adopted – version for public consultation". Consultation closed 20 November 2024.

**Currency flag: I could not locate an adopted final Version 2.0 as of August 2026.** The EDPB page ([here](https://www.edpb.europa.eu/our-work-tools/documents/public-consultations/2024/guidelines-12024-processing-personal-data-based_en)) returned 503 on repeated fetches. Treat v1.0 as the operative EDPB statement, but **verify the current version before relying on paragraph numbers in any document you publish.**

### The three-step test

Both the guidelines (para 6) and *KNLTB*, **C-621/22 (4 Oct 2024), para 37**, set out three cumulative conditions:

> "first, the pursuit of a legitimate interest by the data controller or a third party; second, the need to process personal data for the purposes of the legitimate interests pursued; and, third, that the interests or fundamental freedoms and rights of the person concerned … do not take precedence over the legitimate interest of the controller or of a third party."

**Step 1 — legitimate interest. You pass, and *KNLTB* is your authority.** Para 49: "A commercial interest of the controller … could constitute a legitimate interest, within the meaning of point (f) … provided that it is not contrary to the law." Guidelines 1/2024 para 17 adds three qualifiers: the interest must be **lawful, clearly articulated, and real and present** (not speculative). Your interest — operating a transparency/measurement product on publisher policy toward AI crawlers, sold commercially — is lawful, articulable and present. It is also *third-party* interest-heavy (subscribers, and arguably the public), which Art 6(1)(f) expressly permits and which strengthens your side of the scale.

**Step 2 — necessity. This is where minimisation bites.** *KNLTB* para 42: you must show "the legitimate data processing interests pursued cannot reasonably be achieved just as effectively by other means less restrictive of the fundamental rights and freedoms of data subjects." Guidelines 1/2024 para 29 uses "strictly necessary" and links it to Art 5(1)(c). The *KNLTB* operative part twice repeats "strictly necessary."

Applied: the robots.txt/AI-directive fields are necessary — they *are* the product. The `site_category` label is necessary to a segmentation product but not to the core measurement. **The adult flag is not necessary to any purpose you have described.** That is fatal on its own at step 2 for that field, before you even reach Art 9.

**Step 3 — balancing and reasonable expectations.** Recital 47: reasonable expectations are assessed "at the time and in the context of the collection", by reference to "the relationship between the data subject and the controller". Guidelines 1/2024 paras 50–54; para 53 warns that expectations "do not necessarily depend on the information provided" — you cannot manufacture expectations by writing a privacy notice.

*KNLTB* para 55 is the closest analogue and it is a warning: particular importance attaches to whether members could reasonably expect their data "would be disclosed, for consideration, to third parties … for advertising and marketing purposes." **Disclosure for consideration to third parties is the exact shape of your product.** If your dataset is ever positioned as a prospecting or lead-gen tool, this paragraph lands directly on you.

### The one genuinely strong argument you have

**robots.txt is a document whose entire purpose is to be fetched and interpreted by third-party crawlers.** No website operator who publishes a robots.txt can claim it was unexpected that a crawler fetched and parsed it. This is the single strongest reasonable-expectations argument available to you, and it is much stronger than anything Kaspr or Clearview could say. It applies fully to the AI-crawler-directive fields.

It applies **less** to the homepage fetch (fetching a homepage is expected; *deriving and publishing a classification label* from it is a step further), and **not at all** to the adult field's downstream impact.

### Authority on republishing publicly-available web data commercially

Three current sources, all against reflexive optimism, but all providing a workable template:

**CNIL, [fiche focus: mesures à prendre en cas de collecte par moissonnage](https://www.cnil.fr/fr/focus-interet-legitime-collecte-par-moissonnage) (19 June 2025)** — the most directly on-point official guidance in the EU. Required measures:
- Define precise collection criteria **in advance** and exclude unnecessary categories.
- **Exclude sites that clearly oppose collection** via robots.txt or CAPTCHA. CNIL: *"Le traitement ne pourra pas entrer dans les attentes raisonnables des personnes si son responsable n'exclut pas de la collecte les sites qui s'opposent clairement."*
- Filter out sensitive data where possible; **exclude sites structurally containing sensitive data**; delete incidentally-collected sensitive data immediately.
Recommended: default exclusion lists for intrusive site types (health forums, genealogy); exclude sites whose ToS prohibit collection; **pre-collection opt-out mechanism**; broad public communication about the collection; pseudonymisation immediately post-collection.

**EDPB [Opinion 28/2024](https://www.edpb.europa.eu/system/files/2024-12/edpb_opinion_202428_ai-models_en.pdf) (17 December 2024)** — para 86: web scraping "may lead — in the absence of sufficient safeguards — to significant impacts on individuals, due to the large volume of data collected, the large number of data subjects, and the indiscriminate collection of personal data." Paras 93–94: public availability is **a factor, not an answer**; expectations turn on the source, the privacy settings it offers, and whether the subject made the data public themselves.

**Guidelines 1/2024 paras 46 and 52**: "The fact that personal data have been manifestly made public does not automatically mean that they may be processed under Article 6(1)(f) GDPR." Example 6: even where individuals published photos themselves, third-party commercial reuse in marketing flyers is not within reasonable expectations.

**Italy — Garante, provvedimento n. 329 of 20 May 2024** ([doc. web 10020316](https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/10020316)) — guidance to *publishers* on defending against scraping, not enforcement against scrapers, but it establishes that the Italian authority regards indiscriminate scraping as a live harm.

### Conclusion on Q2

**Art 6(1)(f) is available and defensible for the robots.txt/AI-directive fields and for a conservative `site_category` label — provided you implement CNIL's June 2025 measures and document a written LIA.** It is not available for the adult field, which fails at step 2 (necessity) before Art 9 is reached.

---

## 3. Article 9 — the crux

### Is `adult_self_declaration: true` about a natural person's domain "data concerning sex life or sexual orientation"?

**Honest answer: genuinely unsettled, the risk is real, and the trend of the case law runs against you.** I will give both sides properly, because this is the one question where you should not accept a confident answer from anyone who has not read the cases.

#### The expansive line — why it may be Art 9 data

**1. Art 9(1) catches indirect revelation via deduction.** *OT v Vyriausioji tarnybinės etikos komisija*, **C-184/20 (1 August 2022)**. The Court held that publishing the *name of a declarant's spouse, cohabitee or partner* falls within Art 9(1), because such data "have the potential to reveal the sex life or sexual orientation" of the persons concerned, and it suffices that this occurs through an **"intellectual operation involving comparison or deduction."** (Paragraph numbers reported as ~119–120 in the [European Law Blog commentary](https://www.europeanlawblog.eu/pub/comment-to-case-c-184-20-and-the-perils-of-a-broad-interpretation-of-art-9-gdpr/release/1); commonly cited elsewhere as paras 123 and 128. **I could not verify the numbering against the judgment text — InfoCuria and EUR-Lex both failed to serve it.** The holding itself is not in doubt.) That same commentary criticises the ruling precisely because the Court never says *what kind* of intellectual operation counts — stereotype, common sense, or rigorous inference.

**2. *Meta Platforms v Bundeskartellamt*, C-252/21 (4 July 2023)** — the case you asked about. Via [dpcuria](https://www.dpcuria.eu/case?reference=C-252/21):
- **Para 68**: processing falls under Art 9(1) where "those data allow information falling within one of the categories referred to in that provision to be revealed, **irrespective of whether that information concerns a user of that network or any other natural person**."
- **Paras 69–70**: the prohibition applies "independent of whether or not the information revealed by the processing operation in question is correct", and **irrespective of the controller's intent**.
- **Paras 72–73**: processing of data on visits to websites/apps "may, in certain cases, reveal such information without it being necessary for those users to enter information into them."

Read together with C-184/20, the test is objective and capability-based: **does the output allow the sensitive information to be revealed?** Your subjective framing ("I only recorded a tag") is expressly irrelevant (para 69).

**3. The one-person-adult-site problem.** For a solo adult content creator operating under their own domain, the distinction between "the site's content" and "the person's sexual conduct" collapses. Their commercial sexual activity *is*, on any ordinary reading, their sex life. And note that the flag would be attached to a name-bearing domain, published in bulk, to unknown third parties, permanently, at €49/month.

**4. Recital 51**: special categories merit specific protection "as the context of their processing could create significant risks to the fundamental rights and freedoms." Stigma and discrimination against a named individual is precisely the mischief Art 9 exists to prevent.

**5. Guidelines 1/2024 para 40**: a dataset containing even one sensitive item is "deemed sensitive in its entirety", and data are sensitive if they "allow information falling within one of the categories referred to in Article 9(1) GDPR to be revealed" regardless of intent.

#### The restrictive line — why it may not be

**1. Art 9(1) says "concerning a natural person's sex life or sexual orientation."** A flag that a *publication* carries adult content is data about the content of a publication. A bookseller who stocks erotica has not disclosed their sex life. A publisher of an adult magazine has disclosed a business activity. There is no authority holding that operating an adult website is itself "data concerning sex life."

**2. The deduction is not a deduction.** C-184/20's inference is logically tight: same-sex partner → orientation. Yours is a non-sequitur: "domain carries an RTA tag" → *nothing specific* about the operator's sexual practices, preferences or orientation. The flag is orientation-agnostic. It supports at most an inference about **occupation**, which is not an Art 9 category.

**3. WP136's object/person distinction** applies with real force: the information is *about the object* and relates to the person only indirectly, via ownership.

**4. ICO** on Art 9(2)(e), [conditions for processing](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-conditions-for-processing/), operates on the premise that you process special category data when you can actually *infer* the protected characteristic. Here you cannot infer anything specific.

#### Article 9(2)(e) — does the RTA tag rescue it?

**The governing test, C-252/21:**
- **Paras 74–76**: the derogation applies only to data made public **"by the data subject"** and **"must be interpreted strictly."**
- **Para 77**: it requires that the data subject **"intended, explicitly and by a clear affirmative action, to make the personal data in question accessible to the general public."**
- **Paras 78–79**: mere *visits* to sensitive websites do not qualify — "it cannot be inferred from the mere visit … that the personal data in question were manifestly made public."
- **Paras 80–85**: it can be satisfied where the person "explicitly made the choice beforehand … to make the data relating to him or her publicly accessible to an unlimited number of persons", via settings chosen with full knowledge, or explicit prior consent to viewing by any person.

**Now the crucial narrowing case, which you did not mention and which is directly on your facts: *Schrems v Meta*, C-446/21 (4 October 2024)** ([judgment PDF](https://www.courthousenews.com/wp-content/uploads/2024/10/schrems-meta-ecj-judgment.pdf)):
- Para 75: the derogation covers data "manifestly made public by the data subject."
- Para 77: same "explicitly and by a clear affirmative action" test.
- **Para 79 and the operative part**: Schrems had stated his sexual orientation **at a public panel discussion that was live-streamed and published on YouTube**. The Court held that **Art 9(2)(e) does not authorise the processing of *other* data relating to sexual orientation** merely because the person publicly disclosed their orientation once.
- The Court also ruled on **Art 5(1)(c)**: aggregating and processing all personal data for targeted advertising "without restriction as to time and without distinction as to type of data" breaches minimisation; controllers must refrain from data not "strictly necessary having regard to the purpose" (paras 49, 59).

**Applying this to the RTA tag:**

**In your favour.** Adding `RTA-5042-1996-1400-1577-RTA` or `<meta name="rating" content="adult">` is an **explicit, deliberate, affirmative technical act, taken for the specific purpose of having third-party software read it and communicate it to the general public.** That is a materially cleaner fit with C-252/21 para 77 than any social media post — better than a Facebook setting, better than a public panel appearance. Registering a `.xxx` / `.adult` / `.porn` domain is likewise a public, deliberate, published act with a specifically declarative purpose. If Art 9(2)(e) ever applies to anything, it applies to these.

**Against you — four problems, in ascending seriousness.**

1. **The doctrinal pincer.** To escape Art 9(1) you must say the tag is data about *content*, not about the *person*. To rely on Art 9(2)(e) you must say the *data subject made public a fact about themselves*. You can run these in the alternative (primary: not Art 9(1) data at all; fallback: if it is, the same act satisfies 9(2)(e)) and that is legally orthodox — but you cannot assert both simultaneously as your primary case, and a regulator will notice.

2. **Attribution.** "Manifestly made public **by the data subject**" requires the *data subject's* clear affirmative action. RTA and `meta rating` tags are frequently emitted site-wide by a CMS, a theme, a template, or a web agency — not by the owner. A previous owner may have set them. Some tags persist on domains that changed hands or purpose. Under C-252/21 para 77 that is not a clear affirmative action by the data subject, and under Art 5(1)(d) it is an accuracy problem too.

3. **C-446/21 caps the scope.** Even where 9(2)(e) is satisfied, it authorises processing of *that datum, in that context* — not a licence to build and sell a permanent, redistributed record. Combined with the Art 5(1)(c) holding, "you published it once, so I may republish it indefinitely to paying subscribers" does not survive.

4. **9(2)(e) is not a legal basis.** It lifts the Art 9(1) prohibition only. You still need Art 6, and you still must pass the Art 6(1)(f) balancing and every Art 5 principle. Guidelines 1/2024 paras 46/52 confirm the point; the ICO says the same: *"You cannot use this condition to justify publication of previously unpublished data,"* and *"It's not enough that it's already in the public domain – it must be the person concerned who took the steps that made it public."* The ICO also advises keeping a **record of the source** to evidence manifest publication — which, incidentally, you can do trivially (store the URL, the raw tag bytes, and the fetch timestamp).

#### GC and Others v CNIL, C-136/17 (24 September 2019)

The holdings ([summary](https://www.5rb.com/case/1-gc-2-af-3-bh-4-ed-v-cnil/)):
- **The Art 9 prohibition does apply to search engine operators.** You cannot say "I'm just an index, Art 9 isn't my problem."
- **But their responsibility is specific and attenuated**: the prohibitions "only apply to the search engine operator by reason of that referencing and **following a de-referencing request by the data subject**." Referencing pages containing special-category data is not automatically unlawful *before* a request.
- On balancing: as a general rule the data subject's Charter Arts 7–8 rights override internet users' Art 11 freedom of information, "but the balance may vary in specific cases", assessed by nature and sensitivity of the information, the seriousness of the interference, and any substantial public interest.

**Why this matters to you, and where the analogy breaks.** The *useful* part: an intermediary that re-surfaces what a publisher already published has real but attenuated Art 9 responsibility, and the practical remedy is **suppression on request**. If you build a fast, unconditional suppression channel, you look structurally like a compliant re-publisher rather than an originator.

The *dangerous* part: a search engine **links**; you **redistribute a bulk CSV that subscribers keep and can never be made to forget**. That is a categorically greater interference — and see §6 on Satakunnan, where a court held exactly that against a publisher of a bulk catalogue.

### "Data about content" vs "data about the person" — is there authority?

There is no case squarely on point. The nearest supports are:
- **WP136**'s object/person analysis (a house, a car — information relating to a person only indirectly).
- **C-252/21 paras 78–79**: the mere fact of a *visit* to a sensitive site does not make the visit data manifestly public — implicitly, the Court distinguishes acts *in relation to* sensitive content from statements *about oneself*.
- Against: **C-252/21 para 68**, which says the prohibition bites where the processing reveals Art 9 information about *"any other natural person"* — i.e. the Court has already refused to confine Art 9 to information the data subject supplied about themselves.

**This is genuinely unsettled law. I am not going to pick a side. What I will say is that the asymmetry is what should decide it for you**: if you are right, you gain one field in a €49/month product. If you are wrong, you have an Art 9(1) breach, which sits in the **Art 83(5)** tier (up to €20m / 4% of worldwide annual turnover), plus defamation exposure, plus the fact that the data subjects most affected are exactly the people most motivated and best organised to complain.

---

## 4. Transparency — Art 14

### What Art 14 requires

Data not obtained from the data subject → you must provide, within a reasonable period and **at the latest one month** after obtaining (Art 14(3)(a)), or at latest at first disclosure to another recipient (Art 14(3)(c)): identity and contact details; purposes and **legal basis**; where 6(1)(f), **the legitimate interests pursued** (Art 14(2)(b)); **the categories of personal data** (Art 14(1)(d)); recipients; retention period; the rights including **the right to object**; the right to lodge a complaint with a supervisory authority; and **the source from which the data originate** (Art 14(2)(f)).

### Art 14(5)(b) — disproportionate effort

Exemption where provision "proves impossible or would involve a disproportionate effort", or where it "is likely to render impossible or seriously impair the achievement of the objectives of that processing". Crucially, the same provision requires: *"In such cases the controller shall take appropriate measures to protect the data subject's rights and freedoms and legitimate interests, **including making the information publicly available**."*

**Recital 62** factors: number of data subjects, age of the data, appropriate safeguards adopted.

**[WP260 rev.01 transparency guidelines](https://www.twobirds.com/-/media/pdfs/comparison--article29wptransparencyguidelinespdf.pdf)** (section on Art 14(5)(b), ~paras 61–64):

> "Where a data controller seeks to rely on the exception in Article 14.5(b) on the basis that provision of the information would involve a disproportionate effort, it should carry out a balancing exercise to assess the effort involved for the data controller to provide the information to the data subject against the impact and effects on the data subject if he or she was not provided with the information. This assessment should be documented by the data controller in accordance with its accountability obligations."

Making the information publicly available (website, newspaper, posters) is the **named minimum**; WP260 lists DPIA, pseudonymisation, minimisation and enhanced security as additional measures. Note there is **no comparable exemption under Art 13**.

### Current national guidance — this is where the useful material is

**CNIL, [IA : informer les personnes concernées](https://www.cnil.fr/fr/ia-informer-les-personnes-concernees) (7 February 2025)** — the most workable current statement of how Art 14(5)(b) applies to scraping:
- For **large-scale scraping of non-sensitive, indirectly-identifying data from public sources**, individual notification "will most often be disproportionate."
- Balance the *effort* (absence of contact details, staleness of the data, number of persons, communication cost) against the *impact* (data sensitivity, degree of identifiability, inherent risk).
- **Mandatory compensating measures**: publish a general notice on your own website with the standard Art 14 content, and state your inability to identify persons and to respond to rights requests (Art 11).
- **Strongly recommended**: DPIA, pseudonymisation, limited scope and retention, hardened security.
- **On sources (Art 14(2)(f))**: where sources are few, be specific; where numerous, **categorise them and highlight those presenting the greatest risk**; naming domains and collection dates is recommended, not mandatory.
- Transparency must be "clear and intelligible", delivered in layers with the essentials first.

**The limits — Kaspr.** CNIL decision **SAN-2024-020, 5 December 2024, €240,000** ([CNIL](https://www.cnil.fr/en/data-scraping-kaspr-fined-eu240000)). Breaches: Art 6, Art 5(1)(e), Arts 12 and 14, Art 15. On disproportionate effort: **rejected** — Kaspr claimed it could not identify the source per individual, but CNIL held it knew its sources and had listed them in its own privacy policy. CNIL also faulted a notice sent in English only, and notification delayed four years. Injunctions with a six-month deadline: stop collecting restricted-visibility data, delete unlawfully collected data, stop automatic renewal of retention, inform in comprehensible language, answer access requests with source information.

**Bisnode / WSA Warsaw (11 December 2019)**: "disproportionate effort" means cases where provision is "objectively possible, but extremely difficult (bordering on an inability to provide such information)". **Organisational or financial cost alone does not justify non-compliance**, even for data taken from public sources.

### Is a privacy-notice URL in the User-Agent string adequate?

**Partially adequate. Genuinely valuable. Not sufficient on its own.**

**Why it is not sufficient.** Art 12(1) requires information "in a concise, transparent, intelligible and easily accessible form". A UA string reaches only whoever reads server logs — which excludes almost every sole trader with a WordPress site on shared hosting. It is not "making the information publicly available" in the WP260 / Art 14(5)(b) sense, which contemplates a notice a data subject can realistically find. If it were your only measure, you would be in the same position Kaspr was in: technically something existed, but not something reaching the people concerned.

**Why it is genuinely valuable, and you should do it regardless.** It is the established convention for crawler identification; it delivers notice **at the exact moment and through the exact channel** where a site operator has agency; it is verifiable, timestamped evidence of good faith in your logs and in theirs; and — this is the important part — **it is the delivery mechanism for the opt-out that follows** (see §C.1). A UA token that a site owner can `Disallow` in robots.txt is transparency *plus* an objection mechanism, delivered through the interface the data subject already operates.

**Required combination**: named UA with notice URL **and** a public privacy notice page **and** a public methodology/field-dictionary page **and** a public suppression/objection form **and** honouring a `Disallow` for your named token. That package is defensible under CNIL's February 2025 fiche. Any one of them alone is not.

**One design rule that decides this.** CNIL's balancing turns partly on whether you *have* contact details. **Do not collect them.** If you scrape emails from homepages, you convert a strong Art 14(5)(b) case into the Kaspr case, where the controller knew who to write to and didn't. This is the single cheapest, highest-leverage decision in the whole project.

---

## 5. DPIA — Art 35

### WP248 rev.01

The [Art 29 WP DPIA guidelines (WP248 rev.01)](https://www.dataguidance.com/sites/default/files/20171013_wp248_rev_01_en_d7d5a266-fae9-3ca1-65b7371e82ee1891_47711.pdf) list nine criteria and state the rule of thumb: **"In most cases, a data controller can consider that a processing meeting two criteria would require a DPIA to be carried out."**

Applied to CPI:

| # | Criterion (WP248 wording) | Hit? |
|---|---|---|
| 1 | Evaluation or scoring, including profiling and predicting | **Weak–moderate.** Category assignment is classification of an entity rather than scoring a person. A published *confidence score* would strengthen this hit — so don't publish one. |
| 3 | Systematic monitoring — "processing used to observe, monitor or control data subjects, including data collected through networks" | **Moderate–strong.** Weekly, indefinite, automated observation of the same 50,000 sites, building a longitudinal record. |
| 4 | Sensitive data or data of a highly personal nature | **Strong if the adult field ships. No hit if it doesn't.** This single field flips the analysis. |
| 5 | Data processed on a large scale (Recital 91) | **Strong.** 50,000 domains; a personal-data subset plausibly in the thousands; weekly; indefinite; pan-EU and global. |
| 6 | Matching or combining datasets from operations with different purposes / different controllers, exceeding reasonable expectations | **Moderate.** You combine a third-party popularity ranking + robots.txt observations + homepage-derived labels. |
| 8 | Innovative use or new technological/organisational solutions | **Weak–moderate.** Novel product category. |

**Without the adult field**: criteria 3, 5 and 6 → **at least two → DPIA indicated.**
**With the adult field**: add criterion 4 → **DPIA required, and arguably the residual risk question under Art 36 opens up.**

### The CNPD Luxembourg list — and it is decisive

The CNPD's list under Art 35(4), **adopted 11 March 2019** ([CNPD](https://cnpd.public.lu/fr/professionnels/obligations/AIPD/liste-dpia.html); [summary](https://www.lexgo.lu/en/news-and-articles/5880-gdpr-cnpd-releases-black-list-of-processing-operations-subject-to-a-data-protection-impact-assessment-dpia)), has **eight** entries. Luxembourg publishes **only** a required list — there is **no whitelist**, unlike CNIL's (11 October / 6 November 2018 lists). That matters: in France a marginal processing might be exempted; in Luxembourg you get no such comfort.

Two entries are relevant, and one is a direct hit:

- **Item 3** — *"Les opérations de traitement impliquant la combinaison, la correspondance ou la comparaison de données"* collected from operations with different purposes, **producing legal effects or similarly significant impact**. The "significant effects" qualifier probably rescues you. **Not triggered.**

- **Item 8** — *"Les opérations de traitement reposant sur la collecte indirecte de données à caractère personnel en conjonction avec au moins un autre critère"* [from the EDPB/WP248 criteria], **where the information rights of the data subject cannot be guaranteed or ensured.** **This is a direct hit.** You collect indirectly (never from the data subject). You meet at least one other WP248 criterion (large scale; systematic monitoring). And your entire Art 14 strategy is a declaration that individual information is not feasible.

**Conclusion: under the CNPD's own list, treat a DPIA as mandatory, not optional.** This is the most concrete, actionable finding in this whole analysis. It is also cheap — a weekend of structured writing — and it is simultaneously (a) a legal obligation, (b) a WP260-named compensating measure for Art 14(5)(b), (c) a CNIL-recommended scraping safeguard, and (d) your single best exhibit if a complaint ever lands. **Do it before you ship the new fields, not after.**

Note also: the EDPB opened a public consultation on a **standard DPIA template on 14 April 2026** (consultation to 9 June 2026), per [Luxgap](https://luxgap.com/articles/aipd-modele-cepd-2026-et-divergences-cnpd-cnil/) — secondary source, worth verifying. Until it lands, use the CNIL or CNPD templates.

**Related obligation, easy to miss: Art 30 records of processing.** The under-250-employees exemption in Art 30(5) does **not** apply to you, because the processing is not occasional — and if the adult field ships, Art 30(5) expressly excludes processing of Art 9 data. **You must maintain an Art 30 record.**

---

## 6. Other articles

### Art 21 — right to object

- **Art 21(1)**: where processing is based on 6(1)(e) or (f), the data subject may object **on grounds relating to their particular situation**. You must then **cease** processing **unless you demonstrate compelling legitimate grounds which override** the data subject's interests, rights and freedoms, or the processing is for legal claims. **The burden is on you, and it is a *compelling* grounds test — higher than the ordinary balancing.**
- **Art 21(2)–(3)**: the right to object to processing **for direct marketing purposes is absolute** — no balancing, no grounds required, immediate cessation. Recital 70.

**How this applies to you.** Selling a dataset is not direct marketing *to the data subjects*, so Art 21(2) does not bite on the core product. **But two things could pull it in:**
1. If you email site owners to sell subscriptions, that is direct marketing (and also engages ePrivacy, Art 13 of Directive 2002/58/EC as implemented in Luxembourg).
2. **If the dataset is positioned as a lead-gen or prospecting tool**, the purpose becomes marketing-adjacent, *KNLTB* para 55 lands squarely, and your 6(1)(f) balancing deteriorates sharply. **Prohibit it in the ToS and never market it that way.**

**Practical reality**: contesting an Art 21(1) objection means demonstrating compelling override, in writing, possibly to a regulator, at your cost. For a solo founder that is never worth it over one row in 50,000. **Default to honouring every objection immediately and unconditionally.** Design for that (§C.4).

### Art 17 erasure and Art 17(3)(a)

Erasure obligations arise under Art 17(1)(c) (objection upheld under 21(1) with no overriding grounds), 17(1)(a) (no longer necessary), 17(1)(d) (unlawfully processed). **Art 17(3)(a)** disapplies erasure where processing is necessary "for exercising the right of freedom of expression and information."

This is a real defence, but note what it is: **an exception to erasure, not a lawful basis to process.** And *GC v CNIL* shows the balancing is case-specific and, as a general rule, favours the data subject unless there is substantial public interest in the specific information about the specific person.

### Art 85 and Luxembourg's implementation — the most interesting finding

**Art 85(1)**: Member States "shall by law reconcile the right to the protection of personal data … with the right to freedom of expression and information, including processing for journalistic purposes and the purposes of academic, artistic or literary expression." **Art 85(2)**: they "shall provide for exemptions or derogations" from Chapters II, III, IV, V, VI, VII and IX if necessary to reconcile the two.

**Luxembourg has implemented this in Article 62 of the [Loi du 1er août 2018](https://legilux.public.lu/eli/etat/leg/loi/2018/08/01/a686/consolide/20251226)** ("portant organisation de la Commission nationale pour la protection des données et du régime général sur la protection des données"):

> *"Le traitement mis en œuvre aux seules fins de journalisme ou d'expression universitaire, artistique ou littéraire n'est pas soumis : a) à la prohibition de traiter les catégories particulières de données telle que prévue à l'article 9, paragraphe 1er, du règlement (UE) 2016/679 …"*

Per the [Arendt / Practical Law note on Luxembourg's GDPR implementation](https://www.arendt.com/wp-content/uploads/2024/04/luxembourg_implementation_of_the_gdpr.pdf), Art 62 disapplies:
- **Art 9(1)** — the special categories prohibition **in its entirety**;
- **Art 10** — criminal conviction data;
- **Chapter V** — third-country transfers;
- **Art 13** — where it would compromise data collection;
- **Art 14** — where it would compromise collection, publication, or identification of sources;
and permits limiting access rights and withholding sources.

**If CPI qualified under Art 62, both of your hardest problems — Art 9 and Art 14 — would evaporate.** That is an enormous payoff, and it is why this deserves a lawyer's attention rather than your guess.

**But do not build on it as your primary strategy. Three reasons:**

1. **"Aux seules fins" — solely.** *Satakunnan Markkinapörssi and Satamedia*, **C-73/07 (16 December 2008)**, is helpfully broad ([ipcuria](https://ipcuria.eu/case?reference=C-73%2F07)): para 61 — activities qualify "if their object is the disclosure to the public of information, opinions or ideas", regardless of medium, and extend beyond media undertakings; **para 59 — "the fact that the publication of data within the public domain is done for profit-making purposes does not, prima facie, preclude such publication"**; Ruling 2 — the test is whether "the sole object of those activities is the disclosure to the public of information, opinions or ideas." *Buivids*, C-345/17, confirms the broad reading. **Profit is not the obstacle. "Sole object" and "to the public" are.** A paywalled B2B CSV whose buyers are AI companies, SEO firms and investors is disclosure to *subscribers*, in service of their commercial workflows.

2. **The ECtHR went the other way on almost exactly these facts.** *Satakunnan Markkinapörssi Oy and Satamedia Oy v Finland*, **Grand Chamber, 27 June 2017, application no. 931/13** ([Columbia GFoE](https://globalfreedomofexpression.columbia.edu/cases/case-satakunnan-markkinaporssi-oy-satamedia-oy-v-finland/)). The Court distinguished collecting data for a journalistic file (protected) from **publishing the entire dataset almost verbatim as a catalogue (not protected)**, and held that publications "aimed solely at satisfying the curiosity of a particular readership" are not public-interest contributions. Mass publication of raw data on 1.2 million individuals was held not to serve the public interest. **A per-domain CSV is a catalogue.** This is the closest factual analogue in European law and it went against the publisher.

3. **Structure changes the analysis; wording does not.** This is the one place where what you *build* genuinely moves the legal needle. A product that also publishes a **free public index, a named-author methodology, an aggregate public report, and editorial commentary on AI-crawler policy trends** has a materially stronger Art 62 / Art 17(3)(a) argument than one that only sells CSVs. Not a guaranteed one — but a real one. **Flagging this as genuinely unsettled, Luxembourg-specific, and worth exactly one focused legal opinion.**

### Art 89 — you are right

**Art 89 is not a lawful basis.** Confirmed.

- **Art 89(1)** imposes an **obligation**: processing for archiving in the public interest, scientific or historical research, or statistical purposes shall be subject to **appropriate safeguards**, which "shall ensure that technical and organisational measures are in place in particular in order to ensure respect for the principle of data minimisation", including pseudonymisation where the purposes can be fulfilled that way.
- **Art 89(2)–(3)** are **enabling provisions** allowing Union or Member State law to derogate from certain data subject rights (Arts 15, 16, 18, 19, 20, 21) for those purposes.

What Art 89(1) actually *does*, by being cross-referenced elsewhere: it triggers the **Art 5(1)(b) purpose-compatibility presumption** (further processing for those purposes is not incompatible); permits **extended storage under Art 5(1)(e)**; supports the **Art 17(3)(d)** erasure exception; and is expressly named in **Art 14(5)(b)** and **Art 9(2)(j)**.

**Current EDPB confirmation**: [Guidelines 1/2026 on processing of personal data for scientific research purposes](https://www.ropesgray.com/en/insights/alerts/2026/04/the-european-data-protection-board-releases-new-guidelines-on-the-processing-of-personal-data), **adopted 15 April 2026**, public consultation to **25 June 2026** (so still draft). Article 89(1) is a set of safeguards, not a legal basis — "the presumption of purpose compatibility, extended storage and limitations on data subject rights all depend on their adoption", and a separate Art 6 (and Art 9) basis is required first. On scope: the concept "may not be stretched beyond its common meaning", but **"a profit motive does not disqualify an activity from being scientific research"**, judged against methodical, ethical, verifiable, independent and societally-beneficial criteria.

**Luxembourg implements Art 89 in Articles 63–65** of the Law of 1 August 2018. Art 64 permits processing of Art 9(1) data for **Art 9(2)(j)** purposes; Art 65 lists the required additional measures: DPO appointment, DPIA, anonymisation/encryption, restricted access, audit logging, staff training, independent audits. Art 63 permits restricting the rights of access, rectification, restriction and objection where exercising them would render impossible or seriously impair the purposes, subject to Art 65 safeguards.

**Is Art 9(2)(j) + LU Art 64 a back door for the adult field?** In theory. In practice, no, for one clean reason: **Recital 162 defines "statistical purposes" as processing whose result is aggregate data, "not used in support of measures or decisions regarding any particular natural person."** A per-domain CSV row *is* data about a particular entity, supplied to third parties for decisions about that entity. **But this route does work for aggregate publication** — which is precisely the design fix in §C.2(b). If you want to publish anything about adult self-declaration prevalence, publish it as statistics, not as rows.

---

## 7. Practical enforcement reality

### Actual enforcement against publishers of scraped/derived datasets

| Case | Authority / date | Outcome |
|---|---|---|
| **Kaspr** (LinkedIn contact scraping, resold) | CNIL, **SAN-2024-020, 5 Dec 2024** | **€240,000** + injunctions (6-month deadline, to 18 June 2025) with periodic penalties: stop collecting restricted-visibility data, delete unlawfully collected data, stop retention auto-renewal, inform comprehensibly, answer Art 15 with sources. Breaches: Art 6, 5(1)(e), 12, 14, 15. |
| **Bisnode** (public register data on sole traders) | UODO Poland, **March 2019**, ~PLN 943k (~€220k), Art 14 | **Partly annulled** by WSA Warsaw, 11 Dec 2019 — Art 14 finding upheld for active/suspended sole traders, excluded for ceased traders; fine to be recalculated. Court rejected disproportionate effort: it means "objectively possible, but extremely difficult (bordering on an inability)". |
| **Clearview AI** (scraped facial images, resold) | Dutch AP **€30.5m** (Sept 2024) + order + up to €5.1m periodic penalties; CNIL **€20m** (Oct 2022) + €5.2m penalty payment; Garante **€20m**; Greek HDPA **€20m** | Not a useful benchmark for you: **biometric Art 9 data**, systematic non-cooperation with regulators, no EU establishment. |
| **LocateFamily.com** (published scraped names/addresses) | Dutch AP, 2021, **€525,000** | For failing to appoint an **Art 27 representative**. Shows DPAs will pursue small publishers of scraped personal data — but Art 27 is irrelevant to you (you're established in the EU). |
| **Garante** web-scraping guidance | Italy, provv. n. 329, **20 May 2024** | Guidance to publishers on defending against scraping. Not enforcement against a scraper, but establishes the authority's posture. |

### Your regulator

Established in Luxembourg → **CNPD is your lead supervisory authority** (Art 56), including for complaints lodged by data subjects with other national SAs, which get routed to CNPD under the one-stop-shop.

**CNPD's actual enforcement profile** ([CMS Enforcement Tracker, Luxembourg](https://cms.law/en/deu/publication/GDPR-Enforcement-Tracker-Report/luxembourg)): in **2025**, **7 corrective measures including 6 fines, ranging from €1,277 to €175,000**. The CNPD demonstrates a **preference for administrative corrective measures over monetary penalties**, with a transversal rather than sector-targeted strategy. 2025 focus areas: records of processing, video surveillance, and "transparency, informing data subjects and meeting deadlines when rights are exercised." The €746m Amazon fine (July 2021) was **overturned on appeal in March 2026**; Luxembourg courts now require analysis of intent versus negligence before imposing fines, following the CJEU's December 2023 rulings.

Note the 2025 focus list: **records of processing** and **informing data subjects** are literally two of your three weak points. Have your Art 30 record and Art 14 notice in order.

### Realistic worst case for a solo founder

**Most likely path, by a wide margin.** A site owner sees their row, emails you or complains to their national SA, which routes to CNPD. CNPD opens a complaint file and writes to you. Outcome, if you respond promptly with a DPIA, a documented LIA, an Art 30 record, a published notice and evidence you suppressed the row within days: **informal resolution, or an Art 58(2) corrective order** (suppress, rectify, improve the notice, complete a DPIA). **Fine unlikely.** Cost to you: some weeks of stress and possibly a few thousand euros of legal fees.

**When a fine becomes realistic:**
- You **ignore or contest objections**;
- The **adult field is in scope**, engaging Art 9 → **Art 83(5)** tier (up to €20m / 4%) rather than the Art 83(4) tier (€10m / 2%) that covers Arts 14, 30 and 35;
- You have **no DPIA and no Art 30 record** — both independently sanctionable and both trivially checkable;
- You cannot produce a **written LIA**, so you cannot demonstrate accountability under Art 5(2);
- **Media attention**, or an organised complaint (noyb-style) rather than an individual one.

**Realistic quantum band.** For a micro-undertaking in Luxembourg, CNPD's own 2025 range of **€1,277 – €175,000** is the honest reference. Art 83(2) requires proportionality and dissuasiveness assessed against the undertaking's resources. Kaspr's €240k is at the top of the scraping range and that was a funded company that ignored complaints and whose *business* was reselling contact data. **A conservative CPI with a DPIA and a working suppression channel is not in that world.**

**Risks you should weight at least as heavily as GDPR, and which nobody usually mentions:**

1. **Sui generis database right in the popularity ranking.** A top-50k domain list is very likely licensed data (Tranco, Cloudflare Radar, Chrome UX Report and Majestic all have differing terms; Alexa is dead). Extraction and re-utilisation of a substantial part of a protected database engages **Directive 96/9/EC**, and the contractual ToS engage straightforwardly. **This may be a larger real-world legal risk to your business than GDPR** and it is entirely within your control to fix by choosing a permissively-licensed source and documenting it.
2. **Defamation / personality rights** for an incorrect `adult` or `health` or `finance` label on a named individual's domain. This is a private claim, in whichever Member State the person is, with no €49/month cap.
3. **Payment processor and hosting de-risking** if you become known as "the site that labels people's domains as adult."

---

# A. Verdict

**Split it. The two fields are not in the same universe of risk.**

## `site_category` — a MANAGEABLE compliance problem

Not a legal obstacle. It is a project with a defined scope and a known template.

- Personal data for a minority of rows. Yes, but that's fine — GDPR applying is not the same as GDPR prohibiting.
- **Art 6(1)(f) is available**: *KNLTB* paras 48–49 (commercial interest qualifies); a genuine transparency purpose; low impact; the robots.txt reasonable-expectations argument is strong.
- **Art 14(5)(b) is available** on CNIL's 7 Feb 2025 framework, *provided* you never collect contact data and you publish a proper notice.
- **DPIA is required** under CNPD list item 8. It costs days.
- **Suppression channel** is required in practice, not just in principle.
- Residual risk: **low**. Worst realistic outcome is a corrective order.

Ship it, with the design measures below.

## `adult_self_declaration` — a REAL problem

Not because it is *certain* to breach Art 9. It may well not be. It is a real problem because of the shape of the bet:

- **The legal question is genuinely unsettled** and the CJEU's direction of travel — C-184/20, C-252/21 para 68 (reveals "any other natural person"), paras 69–70 (intent irrelevant) — is expansive.
- **The Art 9(2)(e) fallback, though unusually strong on these facts** (an RTA tag is a cleaner "explicit, clear affirmative action" than anything in C-252/21 or C-446/21), is (i) narrowed by C-446/21 para 79 to *that datum in that context*, (ii) vulnerable on attribution where a CMS or agency set the tag, and (iii) **not a lawful basis** — you still need Art 6 and you still fail the *necessity* limb, because the field is not necessary to any purpose you have articulated.
- **The downside is asymmetric and severe**: Art 9 breach sits in the Art 83(5) tier; add defamation exposure for false positives; add the fact that the affected individuals are the most motivated complainants you could possibly choose.
- **The upside is one field in a €49/month product.**

**This is a bad trade at any plausible probability.** Do not publish it per-row against domains you cannot positively establish are non-natural-person. See §C.2 for the versions that keep most of the commercial value.

---

# B. What wording and framing CAN and CANNOT achieve

## Where framing genuinely changes the legal analysis

These work because **they change the processing, not just its description.** That is the whole test.

**1. Observation vs inference — REAL, and your best single move.**
"Recorded: RTA self-declaration meta tag present at `https://example.com/`, fetched 2026-08-14T03:12Z, raw value `RTA-5042-1996-1400-1577-RTA`" is a **different processing operation** from "`adult: true`". The first is a verifiable factual record of a machine-readable statement that the publisher deliberately broadcast; the second is a controller-assigned classification. This is better under **Art 5(1)(d)** (accuracy — the first is provably accurate, the second is an assertion you must defend), under the **Art 9 "reveals"** analysis (you assert nothing about a person), and under **Art 9(2)(e)** (you are recording precisely the thing the subject affirmatively published — and the ICO expressly recommends keeping a record of the source to evidence manifest publication).
**But it only works if the data model actually changes.** Renaming `adult_self_declaration` to `content_rating_declaration` while emitting identical semantics to identical subscribers is theatre, and C-252/21 paras 69–70 dispose of it: intent is irrelevant if the output reveals.

**2. Data-about-a-site vs data-about-a-person — REAL, but bounded.**
WP136 supports it (information about objects relates to persons only indirectly). *Nowak* para 35 limits it (content, purpose **or** effect — any one suffices). It works where the effect on the individual is genuinely absent. **It fails entirely where the domain is the person's name**, and it fails where the label carries stigma. So: it protects `site_category: ecommerce` on `acme-widgets.de`. It does not protect `adult: true` on `janedoe.com`.

**3. Purpose framing — REAL, because purpose is an input to necessity and balancing.**
"Measuring how publishers declare policy toward AI crawlers" and "profiling websites and their operators" are different purposes, and both the *KNLTB* necessity test and the Guidelines 1/2024 balancing take purpose as a primary input. **But the purpose must be true and the field set must actually be limited to it.** A stated purpose contradicted by your marketing copy is worse than no stated purpose.

**4. ToS restrictions on downstream use — REAL, as mitigating measures.**
Guidelines 1/2024 paras 55–59 count mitigating measures in the balancing, and require them to go **beyond what the GDPR already obliges you to do** (para 57). Contractually prohibiting re-identification, enrichment with personal data, direct marketing and lead-gen is exactly such a measure, and it neutralises the *KNLTB* para 55 problem. Make it enforceable, not decorative.

**5. Product structure for Art 85 / Art 17(3)(a) — REAL, and unsettled.**
Adding a free public index, published methodology, named authorship and editorial commentary genuinely strengthens the Luxembourg Art 62 and Art 17(3)(a) arguments. This is structure, not wording. See §6 and §E.

## Where framing is legally irrelevant

**You cannot re-label personal data into non-personal data.** Everything below is a version of trying.

1. **"This is business data / B2B data / corporate data / open data / public data / site metadata."** *Schecke* para 59: "it is of no relevance … that the data published concerns activities of a professional nature." Recital 26 is about identifiability, not nomenclature.

2. **"Subscribers are the controller; we're just a processor."** Controllership is determined by who decides purposes and means (Art 4(7)); it is a factual question and you plainly decide both. Contractual self-designation is not decisive.

3. **"We do not process personal data" / "any resemblance to a natural person is coincidental."** A disclaimer contradicted by the data has no effect and is evidence of a failure to assess.

4. **"By publishing a website / by not blocking our crawler, they consented."** Consent has a defined meaning (Art 4(11)) and Recital 32 excludes silence and inactivity. Absence of a `Disallow` is not consent, and it is not "manifestly made public" under C-252/21 para 77.

5. **"We only republish what's already public."** Guidelines 1/2024 paras 46/52 say the opposite; so does the ICO; so does *Schecke* paras 58–59 (internet publication to an unlimited audience is itself a serious interference); so does the ECtHR in *Satakunnan*. **Publication is a distinct processing operation with its own impact and its own justification requirement.**

6. **"It's data journalism / research."** Art 89 is not a lawful basis (EDPB Guidelines 1/2026). LU Art 62 requires the **sole** purpose. *Satakunnan* (ECtHR) held a bulk catalogue is not protected expression. Calling it research in your ToS while operating as a data vendor is the fact pattern that loses.

7. **"We say 'declared' rather than 'is'."** Helpful and worth doing — but if you publish the same flag against the same identifiable individuals to the same subscribers, the C-252/21 para 68 "allows the information to be revealed" test is unmoved. **Wording without a change in distribution or suppression does nothing.**

---

# C. Design measures, ranked

Ranked by risk reduction × feasibility ÷ commercial cost.

**1. Named crawler UA + honoured robots.txt opt-out. (Do this first. Near-zero cost, largest effect.)**
Ship `CrawlPriceIndexBot/1.0 (+https://crawlpriceindex.com/crawler)`. Publish the token. Honour `Disallow: /` for that token across the *entire* product: no homepage fetch, no `site_category`, no adult field. The row degrades to robots.txt-only observation or drops out.
Why it's #1: it satisfies CNIL's central requirement ("the processing cannot meet reasonable expectations if the controller fails to exclude sites clearly opposing collection"); it delivers transparency **and** an objection mechanism **at the moment of collection, through the interface the data subject already operates**; it is uniquely available to you because your data subjects are, by definition, people who run robots.txt files. Nothing else in this list combines that much legal value with that little cost.

**2. Remove `adult_self_declaration` from per-domain rows for anything not positively established as non-natural-person.** In descending order of preference:
   - **(a) Suppress entirely** unless the domain appears on a verified organisation list (company register match, known-brand list, or `.gov`/institutional TLDs).
   - **(b) Aggregate-only publication**: "N of the top 50,000 carry a self-declared adult rating", broken down by TLD, country, category. This preserves nearly all analytical value, sits comfortably within "statistical purposes" (Recital 162: results are aggregate, not used for measures or decisions regarding any particular natural person), and takes the field out of Art 9 territory entirely.
   - **(c) Per-row only for `.xxx` / `.adult` / `.porn` TLDs**, never for RTA or `meta rating` on other TLDs. Rationale: TLD registration in a sponsored adult TLD is the strongest possible "explicit, clear affirmative action" under C-252/21 para 77, it is a public act of record, and it cannot have been set accidentally by a CMS theme. Still needs legal sign-off.

**3. Never collect or store contact data.** No emails, no WHOIS registrant fields, no names, no phone numbers, no social handles — not even transiently. This (i) preserves your **Art 14(5)(b)** case, which Kaspr lost precisely because it knew who to contact; (ii) keeps **Art 11** available (processing not requiring identification); (iii) makes the lead-gen framing impossible; (iv) collapses impact severity in the balancing. **Accept this as a hard product constraint.**

**4. Suppression / objection channel with a published SLA.** No justification required (do not make people explain their "particular situation" under Art 21(1) — just honour it). Domain-keyed. Applied at **crawl time** as well as at publication time. Applied to **historical archives you continue to distribute**. Published SLA: next weekly build, maximum 14 days. Log every request, decision and date. This is the single measure most likely to stop a complaint becoming a CNPD file.

**5. DPIA (Art 35) + written LIA + Art 30 record — before you ship the new fields.** Required under CNPD list item 8; named as a compensating measure by WP260 and CNIL; two of the three are in CNPD's stated 2025 enforcement focus. Days of work. Non-negotiable.

**6. Minimise the taxonomy.** Drop `health` and `finance` for natural-person domains (a `health` label on `dr-jane-smith.lu` invites an Art 9 argument you do not need, and a `finance` label invites regulatory-adjacent inferences). Be generous with `unclassified`. **Never publish a confidence score for a natural-person domain** — scoring is WP248 criterion 1 and you gain nothing by triggering it.

**7. Publish observations, not conclusions.** Restructure the schema so every field is either a raw observation with a URL and timestamp, or is explicitly flagged `derived`. Do not publish anything you cannot point to a byte for.

**8. Retention and versioning discipline.** Do not accumulate an indefinite per-domain personal time series. Set a documented retention (e.g. 24 months per-domain, older data aggregated only), per Art 5(1)(e). Suppressions must propagate backwards into any archive you still distribute.

**9. ToS obligations on subscribers**, with a technical hook: publish a per-build **suppression delta file** so subscribers can mechanically honour deletions. A contractual restriction subscribers cannot operationalise is worth much less in the balancing than one they can.

**10. A free public layer.** Public methodology page, free aggregate report, named authorship, commentary. Low cost; it is the only thing that gives the Art 85 / LU Art 62 / Art 17(3)(a) arguments any traction; and it independently increases the public-interest weight on your side of the 6(1)(f) balance.

**11. Honour `User-agent: * / Disallow: /` for the homepage fetch generally**, not just for your own token. Always fetch `/robots.txt` — that file exists to be fetched by anyone, and no operator can claim otherwise.

**12. Trade through a Luxembourg company (S.à r.l.), not personally.** Doesn't change the GDPR analysis, but limits personal exposure and improves your standing with a regulator.

**13. Do NOT bother trying to exclude EU domains.** GDPR applies to you under **Art 3(1)** by virtue of your Luxembourg establishment, regardless of where the data subjects are. Geographic filtering buys you nothing.

---

# D. Recommended language

Drafts to adapt, not to copy blindly. Have a lawyer review before publication.

## D.1 Privacy notice (`/privacy` — linked from the crawler UA string)

> ### Crawl Price Index — Data Protection Notice
>
> **Who we are.** [Entity, address, Luxembourg]. Contact: privacy@crawlpriceindex.com. We are the controller for the processing described below.
>
> **What we do.** Each week we fetch the publicly served `/robots.txt` file, and where permitted the public homepage, of approximately 50,000 internet domains selected from a public popularity ranking. We record how each domain declares its policy toward 18 named AI crawlers, and we assign a general category describing the type of content the site publishes. We publish the resulting dataset to paying subscribers.
>
> **Whose data this concerns.** Most of the domains we observe belong to companies and organisations. Data protection law does not apply to information about legal persons. However, a minority of domains belong to identifiable individuals — sole traders, freelancers, and people running personal or professional sites. Where that is the case, the record we publish about the domain may constitute personal data relating to that individual. This notice is addressed to those individuals.
>
> **What we record.** The domain name; the date and time of each fetch; the content of the `/robots.txt` file as served, including directives naming AI crawlers; the HTTP status of the homepage request; and a general site category assigned by us. **We do not collect, store or publish names, email addresses, postal addresses, telephone numbers, WHOIS registrant details, social media handles, or any other contact information. We do not attempt to identify the person behind any domain.**
>
> **Where the data comes from (Art 14(2)(f)).** Two sources: (1) the domain's own public `/robots.txt` and homepage, fetched directly by our crawler `CrawlPriceIndexBot`; (2) a published domain popularity ranking, [name and link the specific source].
>
> **Why we do it, and our legal basis.** We rely on **Article 6(1)(f) GDPR** — legitimate interests. Our interest, and that of our subscribers and of the wider public, is in measuring and making visible how website publishers declare their policy toward automated AI crawlers. This is a matter of live public and commercial debate, and no comparable systematic measurement is otherwise available. We have carried out and documented a legitimate interests assessment; we will provide a summary on request.
>
> **Why we have not contacted you individually (Art 14(5)(b)).** We observe roughly 50,000 domains and hold no contact details for any of them. Deliberately obtaining contact details in order to write to every domain owner would require us to collect far more personal data than we currently hold, and would be substantially more intrusive than the processing itself. We have weighed the effort against the impact on individuals and concluded that individual notification would involve disproportionate effort. In accordance with Article 14(5)(b) we therefore make this information publicly available here, identify our crawler in every request we make so that it can be recognised in your server logs, and publish the opt-out and objection mechanisms described below. We have documented this assessment and completed a data protection impact assessment.
>
> **How to stop us before we collect anything.** Add the following to your `/robots.txt`:
> ```
> User-agent: CrawlPriceIndexBot
> Disallow: /
> ```
> We check this on every run. Your domain will be excluded from homepage fetching and from all derived fields, permanently and automatically, with no further action needed from you.
>
> **How long we keep it.** Per-domain records for 24 months, after which only aggregate statistics are retained.
>
> **Who receives it.** Paying subscribers, under terms that prohibit them from attempting to identify individuals, from enriching the dataset with personal data, and from using it for direct marketing or lead generation, and that require them to delete records we withdraw.
>
> **Your rights.** You have the right of access (Art 15), rectification (Art 16), erasure (Art 17), restriction (Art 18) and **objection (Art 21)**. **You do not need to give us a reason to be removed** — see [/remove]. You may lodge a complaint with the Commission nationale pour la protection des données (CNPD), 15 boulevard du Jazz, L-4370 Belvaux, Luxembourg, or with the supervisory authority in your country of residence.
>
> **Note on identification (Art 11).** We hold no information that allows us to identify the individual behind a domain. If you ask us to act on your rights, we may ask you to demonstrate control of the domain (for example, by serving a token we supply at a URL on it, or replying from an address at that domain).
>
> Last updated: [date]. Version [n]. Previous versions: [link].

## D.2 Dataset field definitions (publish as `/methodology`, and ship as a `FIELDS.md` with every download)

> **`domain`** — The registrable domain observed, as it appears in the source popularity ranking.
>
> **`observed_at`** — UTC timestamp of the `/robots.txt` fetch for this row.
>
> **`robots_txt_status`** — HTTP status returned. Observation.
>
> **`ai_crawler_directives`** — For each of the 18 named user-agent tokens: the directive found in the domain's own `/robots.txt`, reproduced as served. **This is a verbatim record of what the domain published. It is not our interpretation of the publisher's intentions, and it is not a legal opinion about whether that publisher has granted or withheld any permission.**
>
> **`homepage_fetched`** — `true` / `false` / `excluded_by_robots`. `excluded_by_robots` means the domain's `/robots.txt` disallowed our crawler; we did not request the homepage and no fields below are populated.
>
> **`site_category`** — A general classification of **the type of content the website publishes**, assigned by Crawl Price Index from automated analysis of the public homepage. Values: `news_media`, `ecommerce`, `software_saas`, `education`, `government`, `community_forum`, `entertainment`, `not_a_content_site`, `unclassified`.
> **This field describes the website. It is not a statement about any person, and it must not be read as a statement about the occupation, business, finances, health, beliefs or characteristics of any individual associated with the domain.** It is derived, automated and may be wrong. `unclassified` is used whenever confidence is insufficient — it carries no adverse meaning. Corrections: [/remove].
>
> **`self_declared_content_rating`** *(only present where included)* — **A verbatim record of a voluntary self-labelling declaration published by the site itself**, being either an RTA meta tag (`RTA-5042-1996-1400-1577-RTA`) or `<meta name="rating" content="...">`, together with the URL and timestamp at which it was observed. Values are reproduced as served.
> **Crawl Price Index does not analyse, classify or make any assessment of the content of any website. This field records only that the site published a self-labelling tag. It is not an assertion by us that the site contains any particular material, and it is not, and must not be treated as, information about any individual's sex life, sexual orientation, or personal conduct.** Site owners may remove the tag from their own site, or exclude themselves entirely via [/remove] or robots.txt.
>
> *(Recommended: this field is not published at per-domain level. See the aggregate report at [/reports].)*
>
> **`label_source`** — `observed` (a verbatim record of bytes served by the domain) or `derived` (assigned by Crawl Price Index).
>
> **Accuracy.** Derived fields are produced automatically at scale and will contain errors. Anyone who believes a row about their domain is inaccurate, or wishes their domain excluded, may use [/remove]; we act within one weekly build and no later than 14 days, and no explanation is required.

## D.3 Terms of Service — the clauses that matter

> **X.1 Nature of the dataset.** The Dataset describes websites and the machine-readable policy files they publish. It is not a directory of people, a contact database, or a source of business intelligence about individuals. It contains no names, contact details or identifiers of individuals.
>
> **X.2 Prohibited uses.** You must not, and must not permit any third party to:
> (a) use the Dataset, alone or combined with any other source, to identify, single out or profile any natural person;
> (b) enrich, join or cross-reference the Dataset with any dataset containing names, contact details, or other personal data of individuals;
> (c) use the Dataset for direct marketing, lead generation, prospecting, or the compilation of contact lists;
> (d) use the Dataset to make, or to inform, any decision about a natural person, including decisions on creditworthiness, employment, insurance, tenancy, or access to any service;
> (e) publish or redistribute per-domain records to any third party. Aggregate statistics derived from the Dataset may be published freely.
>
> **X.3 Suppression.** Where we withdraw a record, we publish the withdrawal in the suppression delta file accompanying the next build. **You must delete withdrawn records from all copies, derived works and backups within 30 days**, and must not reinstate them from any earlier build. This obligation survives termination.
>
> **X.4 Your own compliance.** Where any record constitutes personal data in your hands, you are an independent controller in respect of your use of it and are responsible for your own legal basis, transparency and rights handling.
>
> **X.5 No warranty as to derived fields.** Derived fields are produced by automated classification at scale, are provided as-is, and may be inaccurate. **They must not be relied upon as statements of fact about any website, business or person.**
>
> **X.6 Breach.** Breach of X.2 or X.3 is a material breach permitting immediate termination without refund.

## D.4 Correction / objection form (`/remove`)

> ### Remove or correct a domain
>
> **You do not need to give a reason, and you do not need to tell us who you are.** If you control a domain and want it out of Crawl Price Index, we will remove it.
>
> **Fastest route — no form.** Add this to your `/robots.txt`:
> ```
> User-agent: CrawlPriceIndexBot
> Disallow: /
> ```
> We check on every run. Your domain is excluded from the next build automatically and permanently.
>
> **Or use this form:**
>
> - **Domain:** `____________________`
> - **What would you like us to do?**
>   - ☐ **Remove this domain from the dataset entirely** (we will stop crawling it and withdraw all published records)
>   - ☐ **Remove specific fields only** — which: `____________`
>   - ☐ **Correct a specific value** — field: `______` correct value: `______`
> - **Optional — is this a personal domain?** ☐ Yes, this domain relates to me as an individual ☐ No / prefer not to say
>   *(This helps us prioritise. It changes nothing about whether we act.)*
> - **Optional — anything you want us to know:** `____________________`
> - **A reply address, if you want confirmation:** `____________________`
>   *(Optional. We use it only to confirm this request and then delete it.)*
>
> **Verifying control of the domain.** For removals we generally act without verification. For **corrections** — where you are asking us to publish something different — we will ask you to demonstrate control, either by replying from an address at that domain, or by serving a short token we give you at a URL on the domain. We ask for this only to prevent third parties altering records about your site.
>
> **What happens next.** We act in the next weekly build, and in any event **within 14 days**. Removals are permanent: the domain goes on a persistent exclusion list applied both at crawl time and at publication, and is withdrawn from historical archives we continue to distribute. Subscribers are contractually required to delete withdrawn records within 30 days.
>
> **If you are not satisfied**, you may complain to the Commission nationale pour la protection des données (CNPD), Luxembourg, or to the data protection authority in your own country.

---

# E. Lawyer vs. your own call

## Decide yourself — no lawyer needed

- **Whether to publish the adult field per-row.** Don't, for anything not positively established as non-natural-person. This is a product decision with an obvious answer, not a legal one.
- **Design measures 1, 3, 4, 6, 7, 8, 11, 13.** All are unambiguously risk-reducing, cheap, and require no legal judgement.
- **Drafting the first versions** of the DPIA, the LIA, the Art 30 record, the privacy notice, the field dictionary and the removal form. Write them yourself; you understand the system. Have a lawyer review, not author — it's a fraction of the cost.
- **Whether to add the free public/editorial layer.** A business decision that happens to have legal upside.
- **Choosing a permissively-licensed popularity ranking.** Read the licence yourself.

## Get a lawyer — Luxembourg data protection counsel, one focused engagement

Ranked by value per euro:

1. **Whether Article 62 of the Law of 1 August 2018 could ever cover this product.** Highest payoff by a distance: it would disapply **Art 9(1) entirely** and Art 14. It is a genuinely open, Luxembourg-specific question turning on how you structure the product ("aux seules fins"), against *Satamedia* (broad, helpful) and ECtHR *Satakunnan* (narrow, unhelpful). **Ask for a written opinion with a yes/no/conditional and, if conditional, what you would have to build.** One opinion, scoped tightly.

2. **Sign-off on the Article 9 position** for whatever form of the adult field you ship — specifically whether a `.xxx`/`.adult`/`.porn`-TLD-only per-row field can be carried by Art 9(2)(e) + Art 6(1)(f). Do not ship any per-row adult field without this.

3. **Review of the DPIA conclusion and whether Art 36 prior consultation is needed.** Only if residual high risk remains after mitigation. Cheap to ask; expensive to get wrong.

4. **The database rights and licensing position on the popularity ranking** (contract + sui generis right, Directive 96/9/EC). **This is not a GDPR question and may be your largest actual legal exposure.** Get IP counsel, not privacy counsel.

5. **Whether you need a DPO under Art 37(1)(b).** Genuinely arguable: your core activity involves large-scale, regular and systematic *observation* of entities, and if any part of it is characterised as monitoring data subjects, Art 37(1)(b) is engaged. My view is probably not — you monitor *sites*, hold no identifiers, and do not track individuals — but it is close enough to be worth one paragraph of advice, and getting it wrong is independently sanctionable.

6. **ToS drafting, liability caps, and defamation/personality-rights exposure** for incorrect labels — particularly the adult field, and particularly cross-border. A €49/month product has no natural cap on that liability without careful drafting.

**Not needed**: an Art 27 representative (you are established in the EU); GDPR-related geographic filtering; a DPA with subscribers (they are independent controllers, not processors).

---

## Points where I am telling you the law is genuinely unsettled

I am not going to resolve these for you, and you should distrust anyone who does:

1. **Whether an adult-content self-declaration attached to a natural person's domain is Art 9(1) data.** No case decides it. C-184/20 and C-252/21 para 68 point one way; the text of Art 9(1) ("concerning a natural person's sex life") and WP136's object/person analysis point the other. **Live dispute.**
2. **Whether an RTA meta tag satisfies Art 9(2)(e).** It fits C-252/21 para 77 unusually well; it is undermined by attribution problems and by C-446/21's narrowing. **No authority either way.**
3. **Whether Article 62 of the Luxembourg Law of 1 August 2018 could reach a paid data product with a public editorial layer.** *Satamedia* is encouraging; ECtHR *Satakunnan* is discouraging; nothing decides it. **Lawyer question.**
4. **The final text of EDPB Guidelines 1/2024.** I could not confirm that a Version 2.0 has been adopted; verify before citing paragraph numbers publicly.
5. **Whether the Digital Omnibus will change the Art 4(1) definition of personal data.** Negotiations stalled on 30 June 2026. **Do not design around it.**

---

## Sources

**Legislation**
- [GDPR, Regulation (EU) 2016/679](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A32016R0679) — Arts 4(1), 5, 6(1)(f), 9, 11, 14, 17, 21, 30, 35, 36, 83, 85, 89; Recitals 14, 26, 32, 47, 51, 62, 70, 91, 153, 162
- [Loi du 1er août 2018 (Luxembourg), consolidated](https://legilux.public.lu/eli/etat/leg/loi/2018/08/01/a686/consolide/20251226) — Arts 62 (Art 85 derogation), 63–65 (Art 89 safeguards) · [text](https://data.legilux.public.lu/file/eli-etat-leg-loi-2018-08-01-a686-jo-fr-html.html) · [Arendt/Practical Law analysis](https://www.arendt.com/wp-content/uploads/2024/04/luxembourg_implementation_of_the_gdpr.pdf)

**CJEU**
- [EDPS v SRB, C-413/23 P (4 Sept 2025) — press release](https://curia.europa.eu/site/upload/docs/application/pdf/2025-09/cp250107en.pdf) · [judgment](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX%3A62023CJ0413) · [Taylor Wessing](https://www.taylorwessing.com/en/insights-and-events/insights/2025/09/analysis-of-the-cjeu-judgment) · [Fieldfisher](https://www.fieldfisher.com/en-be/locations/belgium/insights/edps-v-srb-cjeu%E2%80%99s-contextual-approach-to-pseudonym)
- [Schrems v Meta, C-446/21 (4 Oct 2024)](https://www.courthousenews.com/wp-content/uploads/2024/10/schrems-meta-ecj-judgment.pdf)
- [KNLTB, C-621/22 (4 Oct 2024)](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A62022CJ0621)
- [Meta Platforms v Bundeskartellamt, C-252/21 (4 July 2023)](https://www.dpcuria.eu/case?reference=C-252/21)
- [OT v Vyriausioji tarnybinės etikos komisija, C-184/20 (1 Aug 2022) — commentary](https://www.europeanlawblog.eu/pub/comment-to-case-c-184-20-and-the-perils-of-a-broad-interpretation-of-art-9-gdpr/release/1) · [Stevens & Bolton](https://www.stevens-bolton.com/site/insights/articles/the-cjeu-widening-the-definition-of-sensitive-personal-data)
- [GC and Others v CNIL, C-136/17 (24 Sept 2019)](https://www.5rb.com/case/1-gc-2-af-3-bh-4-ed-v-cnil/) · [EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A62017CJ0136)
- [Nowak, C-434/16 (20 Dec 2017)](https://www.dpcuria.eu/case?reference=C-434%2F16)
- [Schecke and Eifert, C-92/09 & C-93/09 (9 Nov 2010)](https://dpcuria.eu/case?reference=C-92/09)
- [Satakunnan Markkinapörssi and Satamedia, C-73/07 (16 Dec 2008)](https://ipcuria.eu/case?reference=C-73%2F07)

**ECtHR**
- [Satakunnan Markkinapörssi Oy and Satamedia Oy v Finland, GC, no. 931/13 (27 June 2017)](https://globalfreedomofexpression.columbia.edu/cases/case-satakunnan-markkinaporssi-oy-satamedia-oy-v-finland/)

**EDPB / Art 29 WP**
- [Guidelines 1/2024 on Art 6(1)(f), v1.0, 8 Oct 2024](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202401_legitimateinterest_en.pdf) · [status page](https://www.edpb.europa.eu/our-work-tools/documents/public-consultations/2024/guidelines-12024-processing-personal-data-based_en)
- [Opinion 28/2024 on AI models, 17 Dec 2024](https://www.edpb.europa.eu/system/files/2024-12/edpb_opinion_202428_ai-models_en.pdf)
- [Guidelines 1/2026 on scientific research, 15 Apr 2026 — analysis](https://www.ropesgray.com/en/insights/alerts/2026/04/the-european-data-protection-board-releases-new-guidelines-on-the-processing-of-personal-data)
- [EDPB–EDPS Joint Opinion 2/2026 on the Digital Omnibus, 10 Feb 2026](https://www.edpb.europa.eu/system/files/2026-02/edpb_edps_jointopinion_202602_digitalomnibus_en.pdf)
- [WP248 rev.01 — DPIA guidelines](https://www.dataguidance.com/sites/default/files/20171013_wp248_rev_01_en_d7d5a266-fae9-3ca1-65b7371e82ee1891_47711.pdf)
- [WP260 rev.01 — transparency guidelines](https://www.twobirds.com/-/media/pdfs/comparison--article29wptransparencyguidelinespdf.pdf)
- [WP136 — Opinion 4/2007 on the concept of personal data](https://ec.europa.eu/justice/article-29/documentation/opinion-recommendation/files/2007/wp136_en.pdf)
- [EDPB guidance to ICANN on WHOIS, 13 July 2018](https://www.icann.org/en/blogs/details/data-protectionprivacy-update-additional-guidance-from-the-european-data-protection-board-13-7-2018-en)

**National DPAs**
- CNPD (Luxembourg): [DPIA list, 11 March 2019](https://cnpd.public.lu/fr/professionnels/obligations/AIPD/liste-dpia.html) · [announcement](https://cnpd.public.lu/fr/actualites/national/2019/03/liste-DPIA.html) · [list summary](https://www.lexgo.lu/en/news-and-articles/5880-gdpr-cnpd-releases-black-list-of-processing-operations-subject-to-a-data-protection-impact-assessment-dpia) · [French text](https://www.mgsi.lu/cnpd/cnpd-liste-des-traitements-pour-lesquels-une-aipd-est-requise/) · [enforcement profile](https://cms.law/en/deu/publication/GDPR-Enforcement-Tracker-Report/luxembourg)
- CNIL: [web scraping under legitimate interest, 19 June 2025](https://www.cnil.fr/fr/focus-interet-legitime-collecte-par-moissonnage) · [informing data subjects, 7 Feb 2025](https://www.cnil.fr/fr/ia-informer-les-personnes-concernees) · [AI checklist, July 2025](https://www.cnil.fr/sites/default/files/2025-07/ia_liste_de_verification.pdf) · [Kaspr, SAN-2024-020, 5 Dec 2024](https://www.cnil.fr/en/data-scraping-kaspr-fined-eu240000)
- Garante (Italy): [provvedimento n. 329, 20 May 2024](https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/10020316)
- ICO: [What is personal data](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/personal-information-what-is-it/what-is-personal-data/what-is-personal-data/) · [Special category conditions](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-conditions-for-processing/)
- Dutch AP: [LocateFamily.com, €525,000](https://www.twobirds.com/en/insights/2021/netherlands/finding-locatefamily-com-dutch-dpa-imposes-525000-euro-fine-for-not-having-a-gdpr-representative) · [Clearview AI, €30.5m](https://www.bankinfosecurity.com/dutch-regulator-fines-clearviewai-30m-for-data-scraping-a-26205)
- UODO (Poland) / WSA Warsaw: [Bisnode, and the appeal](https://iapp.org/news/a/polish-court-overturns-dpas-first-gdpr-fine)

**Legislative status**
- [Digital Omnibus negotiations, July 2026 update](https://www.privacynext.eu/resources/digital-omnibus-negotiations-gdpr-july-2026-update/) · [EDRi analysis of the Council compromise, March 2026](https://edri.org/wp-content/uploads/2026/03/EDRi-Data-Omnibus-Analysis-Council-Compromise-text.pdf)
- [EDPB DPIA template consultation, April 2026, and CNPD/CNIL divergences](https://luxgap.com/articles/aipd-modele-cepd-2026-et-divergences-cnpd-cnil/)
# Music Extender — Architecture (v0, à valider)

Application web de prolongation de morceaux : upload MP3/MP4 → analyse → paroles → voix clonée → instrumental étendu → montage → téléchargement.

Ce document fixe **l'arborescence** et **le schéma de base de données** avant toute écriture de code.

---

## 1. Choix techniques

| Domaine | Choix | Pourquoi |
|---|---|---|
| Front + API | Next.js 15 (App Router), TypeScript, Tailwind | Imposé |
| File d'attente | BullMQ + Redis | Imposé ; un job par étape, reprenable |
| Base de données | PostgreSQL + Prisma | Statut persisté, JSON natif, migrations propres |
| Worker | Process Node séparé (`src/worker`), même code que l'app | Jamais de traitement dans le cycle HTTP |
| Analyse musicale | Script Python `librosa` lancé par le worker (`child_process`) | Plus simple qu'un micro-service ; isolable plus tard |
| Audio | `ffmpeg` (extraction, montage, crossfade, LUFS) | Standard |
| Stockage fichiers | Disque local (`storage/`) derrière `StorageProvider` | Purge 24 h simple ; S3 possible plus tard |
| Séparation stems | Demucs via Replicate | Imposé |
| Transcription | OpenAI Whisper API (`verbose_json` → timestamps) | Imposé |
| Paroles | Claude API | Imposé |
| Voix clonée | Interface `VoiceProvider` ; implémentation `MockVoiceProvider` d'abord, puis une implémentation réelle (voir §4) | Imposé (abstraction) |
| Extension instrumentale | Interface `MusicProvider` ; `MusicGenReplicateProvider` (mode *continuation*) en premier | Imposé |
| Statut temps réel | SSE via Redis pub/sub (le worker publie, la route SSE relaie) | Imposé |
| Auth | Pas de compte : jeton propriétaire aléatoire en cookie httpOnly, lié au projet | Sobre, suffisant pour un outil d'usage direct |

---

## 2. Arborescence

```
music-extender/
├── ARCHITECTURE.md                  ← ce document
├── README.md                        ← installation, variables d'env, lancement
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── .env.example                     ← toutes les clés, jamais commitées en réel
├── docker-compose.yml               ← postgres + redis (+ worker en option)
├── Dockerfile.web
├── Dockerfile.worker                ← node + ffmpeg + python3 + librosa
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── python/
│   ├── requirements.txt             ← librosa, numpy, soundfile
│   └── analyze.py                   ← BPM, tonalité, structure, sections → JSON sur stdout
│
├── storage/                         ← fichiers temporaires (gitignoré), purgés après 24 h
│   └── <projectId>/…
│
└── src/
    ├── app/                         ← Next.js App Router (UI en français)
    │   ├── layout.tsx
    │   ├── globals.css
    │   ├── page.tsx                 ← 1. Upload : zone de drop + lecteur d'aperçu
    │   ├── projets/[id]/
    │   │   ├── layout.tsx           ← barre de progression du pipeline (SSE)
    │   │   ├── page.tsx             ← redirige vers l'écran correspondant au statut
    │   │   ├── analyse/page.tsx     ← 2. BPM, tonalité, structure, paroles éditables
    │   │   ├── consentement/page.tsx← 3. Écran bloquant : droits voix + morceau
    │   │   ├── generation/page.tsx  ← 4. Section, longueur, 2 variantes éditables
    │   │   └── rendu/page.tsx       ← 5. Waveform + jointure, A/B, téléchargement
    │   │
    │   └── api/
    │       ├── upload/route.ts                          POST  multipart → validation → Project + job
    │       ├── projets/[id]/route.ts                    GET   état complet du projet
    │       ├── projets/[id]/events/route.ts             GET   SSE (statuts d'étapes, progression, erreurs)
    │       ├── projets/[id]/transcription/route.ts      PUT   paroles corrigées par l'utilisateur
    │       ├── projets/[id]/consentement/route.ts       POST  déclaration de droits (log horodaté)
    │       ├── projets/[id]/generations/route.ts        POST  lance la génération (section, longueur)
    │       ├── projets/[id]/generations/[gid]/route.ts  PUT   variante choisie / paroles éditées → rendu
    │       ├── projets/[id]/generations/[gid]/retry/route.ts POST relance l'étape en échec
    │       ├── projets/[id]/fichiers/[assetId]/route.ts GET   stream d'un fichier (original, final…)
    │       └── sante/route.ts                           GET   healthcheck (db, redis, ffmpeg, python)
    │
    ├── components/
    │   ├── ui/                      ← Button, Card, Badge, Field… (Tailwind, sobres)
    │   ├── upload/DropZone.tsx
    │   ├── upload/AudioPreview.tsx
    │   ├── pipeline/StepTimeline.tsx← chaque étape : en attente / en cours / ok / erreur (+ raison)
    │   ├── pipeline/ErrorBanner.tsx ← « L'API X a échoué : … » + bouton Relancer
    │   ├── analysis/AnalysisSummary.tsx
    │   ├── analysis/StructureBar.tsx
    │   ├── analysis/LyricsEditor.tsx
    │   ├── consent/ConsentForm.tsx
    │   ├── generation/SectionPicker.tsx
    │   ├── generation/LyricsVariants.tsx
    │   ├── render/Waveform.tsx      ← wavesurfer.js, marqueur de jointure
    │   ├── render/ABPlayer.tsx
    │   └── render/DownloadButton.tsx
    │
    ├── hooks/
    │   └── useProjectEvents.ts      ← client SSE + état local du pipeline
    │
    ├── lib/                         ← code partagé app + worker (serveur uniquement)
    │   ├── env.ts                   ← validation zod des variables d'env
    │   ├── db.ts                    ← client Prisma
    │   ├── redis.ts                 ← connexions BullMQ / pub-sub
    │   ├── queue.ts                 ← définition des files et des noms de jobs
    │   ├── events.ts                ← publish/subscribe des événements projet (SSE)
    │   ├── errors.ts                ← PipelineError { step, provider, code, message, retryable }
    │   ├── owner.ts                 ← jeton propriétaire (cookie) + contrôle d'accès
    │   ├── validation.ts            ← formats, durée max, taille max
    │   ├── storage/
    │   │   ├── StorageProvider.ts   ← interface
    │   │   └── LocalStorageProvider.ts
    │   ├── audio/
    │   │   ├── ffmpeg.ts            ← wrapper (extraction, probe, concat, crossfade, loudnorm)
    │   │   └── waveform.ts          ← génération des pics pour l'UI
    │   └── providers/               ← toutes les API externes derrière des interfaces
    │       ├── types.ts             ← types communs (AudioRef, ProviderResult…)
    │       ├── stems/
    │       │   ├── StemsProvider.ts
    │       │   └── DemucsReplicateProvider.ts
    │       ├── transcription/
    │       │   ├── TranscriptionProvider.ts
    │       │   └── WhisperOpenAIProvider.ts
    │       ├── lyrics/
    │       │   ├── LyricsProvider.ts
    │       │   ├── ClaudeLyricsProvider.ts
    │       │   └── prompt.ts        ← prompt structuré (métrique, rimes, champ lexical)
    │       ├── voice/
    │       │   ├── VoiceProvider.ts
    │       │   ├── MockVoiceProvider.ts
    │       │   └── (implémentation réelle à brancher)
    │       ├── music/
    │       │   ├── MusicProvider.ts
    │       │   └── MusicGenReplicateProvider.ts
    │       └── index.ts             ← fabrique : choix du provider par variable d'env
    │
    ├── pipeline/                    ← une étape = un fichier, pure, reprenable
    │   ├── steps/
    │   │   ├── extractAudio.ts      ← 2. ffmpeg si MP4
    │   │   ├── separateStems.ts     ← 3. Demucs
    │   │   ├── analyze.ts           ← 4. librosa
    │   │   ├── transcribe.ts        ← 5. Whisper
    │   │   ├── generateLyrics.ts    ← 6. Claude (2 variantes)
    │   │   ├── synthesizeVoice.ts   ← 7. VoiceProvider
    │   │   ├── extendMusic.ts       ← 8. MusicProvider
    │   │   └── render.ts            ← 9. montage ffmpeg + LUFS + export
    │   ├── runStep.ts               ← wrapper commun : statut BDD, progression, erreurs, événements
    │   └── graph.ts                 ← enchaînement des étapes et conditions (consentement requis avant 7)
    │
    └── worker/
        ├── index.ts                 ← démarre les workers BullMQ
        ├── processors.ts            ← mappe nom de job → étape
        └── purge.ts                 ← job répétable horaire : projets expirés → suppression fichiers + BDD
```

### Deux phases de pipeline

- **Phase A — automatique après upload** : `extractAudio → separateStems → analyze → transcribe`.
  L'utilisateur arrive sur l'écran d'analyse dès la fin de la phase A et peut corriger les paroles.
- **Phase B — déclenchée par l'utilisateur** (après consentement) : `generateLyrics → [choix variante] → synthesizeVoice → extendMusic → render`.
  Chaque génération est un objet `Generation` distinct : on peut lancer plusieurs sections sur le même projet.

Chaque étape est un job BullMQ isolé. Elle lit ses entrées en BDD/stockage, écrit ses sorties, met à jour `PipelineStep`. Si elle échoue, l'étape reste `FAILED` avec `provider`, `errorCode`, `errorMessage` : l'utilisateur voit *quelle* API a échoué et *pourquoi*, et peut relancer uniquement cette étape.

---

## 3. Schéma de base de données (Prisma / PostgreSQL)

```prisma
enum ProjectStatus {
  UPLOADED      // fichier reçu, phase A en attente
  PROCESSING    // phase A en cours
  READY         // phase A terminée, analyse consultable
  FAILED        // une étape de phase A a échoué (détail dans PipelineStep)
  EXPIRED       // purgé après 24 h
}

enum StepName {
  EXTRACT_AUDIO
  SEPARATE_STEMS
  ANALYZE
  TRANSCRIBE
  GENERATE_LYRICS
  SYNTHESIZE_VOICE
  EXTEND_MUSIC
  RENDER
}

enum StepStatus {
  PENDING
  RUNNING
  DONE
  FAILED
  SKIPPED       // ex. EXTRACT_AUDIO pour un MP3
}

enum AssetKind {
  ORIGINAL          // fichier uploadé tel quel
  AUDIO_SOURCE      // audio extrait / normalisé (wav)
  STEM_VOCALS
  STEM_DRUMS
  STEM_BASS
  STEM_OTHER
  VOICE_SYNTH       // voix générée pour une section
  INSTRUMENTAL_EXT  // instrumental étendu (sortie MusicProvider)
  FINAL_MIX         // rendu final téléchargeable
  WAVEFORM          // pics JSON pour l'UI
}

enum SectionType {
  VERSE     // couplet
  BRIDGE    // pont
  OUTRO
}

enum GenerationStatus {
  LYRICS_PENDING    // génération des paroles en cours
  LYRICS_READY      // 2 variantes proposées, en attente de choix
  RENDERING         // voix + instrumental + montage
  DONE
  FAILED
}

model Project {
  id               String        @id @default(cuid())
  ownerToken       String                          // jeton du cookie, jamais exposé dans l'API
  status           ProjectStatus @default(UPLOADED)
  originalFilename String
  mimeType         String
  sizeBytes        Int
  durationSec      Float?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  expiresAt        DateTime                        // createdAt + 24 h ; utilisé par la purge

  assets        Asset[]
  steps         PipelineStep[]
  analysis      Analysis?
  transcription Transcription?
  consent       Consent?
  generations   Generation[]
  providerCalls ProviderCall[]

  @@index([ownerToken])
  @@index([expiresAt])
}

model Asset {
  id          String    @id @default(cuid())
  projectId   String
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  generationId String?                            // null pour les assets de phase A
  generation  Generation? @relation(fields: [generationId], references: [id], onDelete: Cascade)
  kind        AssetKind
  storageKey  String                              // chemin relatif dans StorageProvider
  mimeType    String
  sizeBytes   Int
  durationSec Float?
  createdAt   DateTime  @default(now())

  @@index([projectId, kind])
}

model PipelineStep {
  id           String     @id @default(cuid())
  projectId    String
  project      Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  generationId String?                            // null pour la phase A
  generation   Generation? @relation(fields: [generationId], references: [id], onDelete: Cascade)
  name         StepName
  status       StepStatus @default(PENDING)
  attempt      Int        @default(0)
  progress     Int        @default(0)             // 0–100
  provider     String?                            // "replicate/demucs", "openai/whisper", "anthropic", …
  jobId        String?                            // id BullMQ
  startedAt    DateTime?
  finishedAt   DateTime?
  errorCode    String?                            // ex. PROVIDER_TIMEOUT, PROVIDER_REJECTED, FFMPEG_FAILED
  errorMessage String?                            // message lisible, en français
  errorDetails Json?                              // payload brut (tronqué) pour le debug
  retryable    Boolean    @default(true)

  @@unique([projectId, generationId, name])
  @@index([projectId, status])
}

model Analysis {
  id            String   @id @default(cuid())
  projectId     String   @unique
  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  bpm           Float
  keyRoot       String                            // "C", "F#", …
  keyMode       String                            // "major" | "minor"
  timeSignature String                            // "4/4" (heuristique)
  durationSec   Float
  loudnessLufs  Float?
  sections      Json                              // [{ label:"intro|verse|chorus|bridge|outro|unknown", startSec, endSec, bars }]
  beats         Json?                             // timestamps des temps (aligne le montage)
  raw           Json?                             // sortie complète de analyze.py
  createdAt     DateTime @default(now())
}

model Transcription {
  id         String   @id @default(cuid())
  projectId  String   @unique
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  provider   String                               // "openai/whisper-1"
  language   String?
  text       String                               // texte brut Whisper
  segments   Json                                 // [{ startSec, endSec, text }]
  editedText String?                              // version corrigée par l'utilisateur (prioritaire)
  editedAt   DateTime?
  createdAt  DateTime @default(now())
}

model Consent {
  id                  String   @id @default(cuid())
  projectId           String   @unique
  project             Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  ownerToken          String
  textVersion         String                      // version du texte de déclaration affiché (ex. "2026-09-v1")
  textHash            String                      // sha256 du texte exact affiché
  declaresVoiceRights Boolean                     // titulaire des droits sur la voix
  declaresTrackRights Boolean                     // titulaire des droits sur le morceau
  acceptedAt          DateTime @default(now())    // log horodaté
  ip                  String?
  userAgent           String?
}

model Generation {
  id              String           @id @default(cuid())
  projectId       String
  project         Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  sectionType     SectionType
  targetLengthSec Int                             // longueur cible demandée
  insertAtSec     Float?                          // point de jointure choisi (par défaut : fin du morceau)
  status          GenerationStatus @default(LYRICS_PENDING)
  chosenVariantId String?          @unique
  chosenVariant   LyricsVariant?   @relation("chosen", fields: [chosenVariantId], references: [id])
  joinPointSec    Float?                          // position réelle de la jointure dans le rendu final
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  variants LyricsVariant[] @relation("variants")
  steps    PipelineStep[]
  assets   Asset[]

  @@index([projectId])
}

model LyricsVariant {
  id           String     @id @default(cuid())
  generationId String
  generation   Generation @relation("variants", fields: [generationId], references: [id], onDelete: Cascade)
  index        Int                                // 0 ou 1
  text         String                             // proposition Claude
  editedText   String?                            // version éditée par l'utilisateur (prioritaire)
  meta         Json?                              // schéma de rimes, syllabes/ligne, champ lexical utilisé
  chosenFor    Generation? @relation("chosen")

  @@unique([generationId, index])
}

// Journal de tous les appels aux API externes : coût, durée, id distant, erreur.
// C'est ce qui permet d'afficher précisément "quelle API a échoué et pourquoi".
model ProviderCall {
  id         String    @id @default(cuid())
  projectId  String
  project    Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  stepId     String?
  provider   String                               // "replicate", "openai", "anthropic", "elevenlabs", …
  operation  String                               // "demucs", "whisper", "lyrics", "musicgen", …
  externalId String?                              // id de prédiction / requête chez le fournisseur
  status     String                               // "ok" | "error"
  httpStatus Int?
  durationMs Int?
  request    Json?                                // paramètres envoyés (sans secrets, sans audio)
  response   Json?                                // résumé de la réponse ou erreur brute tronquée
  createdAt  DateTime  @default(now())

  @@index([projectId, createdAt])
}
```

### Règles d'intégrité gérées côté code

- `SYNTHESIZE_VOICE` ne peut être planifié que si `Consent` existe pour le projet (vérifié dans `graph.ts` **et** dans la route API).
- `expiresAt` est calculé à l'upload ; la purge horaire supprime les fichiers de `storage/<projectId>/` puis passe le projet en `EXPIRED` (ligne conservée 7 jours pour l'audit du consentement, puis supprimée).
- La transcription et les variantes de paroles utilisent toujours `editedText ?? text` : la version utilisateur prime.

---

## 4. Points à valider / angles morts

1. **Emplacement** : ce dépôt est un client web Minecraft. Je propose le sous-dossier `music-extender/` pour ne rien casser. Alternative : un dépôt dédié.
2. **Voix chantée** : les API de clonage grand public (ElevenLabs, PlayHT) produisent de la *parole*, pas du *chant*. Deux options réalistes :
   - **Conversion de voix (RVC)** via Replicate : on génère d'abord une voix guide (TTS ou ligne mélodique), puis on la convertit avec le timbre extrait du stem vocal. Résultat chanté, mais qualité variable.
   - **Génération chant complète** (Suno/Udio-like) : pas d'API publique stable de clonage à ce jour.
   Je propose : `MockVoiceProvider` (renvoie un silence ou le stem vocal réaligné, pour valider tout le pipeline sans coût), puis `RvcReplicateVoiceProvider`. À trancher.
3. **Extension instrumentale** : MusicGen (Replicate) supporte la *continuation* à partir des dernières secondes du morceau, mais ne prolonge que ~30 s par appel et ne « connaît » pas la structure. Le montage ffmpeg (alignement sur la grille de temps de `Analysis.beats`, crossfade) fait le reste. Résultat honnête : cohérent en timbre/tempo, pas garanti en harmonie fine.
4. **Limites d'upload proposées** : 50 Mo, 10 min max. À ajuster.
5. **Sans compte utilisateur** : le cookie propriétaire est le seul contrôle d'accès. Suffisant pour un usage direct, insuffisant pour du multi-utilisateur durable.
6. **Coûts** : chaque génération = 1 appel Demucs + 1 Whisper + 1 Claude + 1 voix + 1 MusicGen. Le journal `ProviderCall` permettra de chiffrer par projet.

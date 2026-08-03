# kingXford & Co narration policy

## Quality standard

kingXford & Co narration must sound deliberate, editorial, and convincingly human. A generic browser voice, an unreviewed text-to-speech export, or a robotic placeholder is not acceptable.

No narration asset is being shipped in this release. Publishing an unreviewed or robotic placeholder would violate the kingXford & Co quality bar. Audio should be added only after the full narration workflow below has been completed and the result has passed editorial and listening review.

If the requirement is literally an actual human voice rather than human-sounding synthesis, kingXford & Co must commission a professional narrator and publish the approved human recording.

## Approved open-source systems

### Primary: Qwen3-TTS 12Hz 1.7B

Use Qwen3-TTS 12Hz 1.7B as the primary synthesis family:

- `CustomVoice` for a consistent licensed built-in voice with editorial style control.
- `VoiceDesign` when kingXford & Co needs an original synthetic narrator designed for the brand.
- The documented Voice Design to Clone workflow may be used to keep an original designed voice consistent across posts.

Official sources:

- Repository: <https://github.com/QwenLM/Qwen3-TTS>
- CustomVoice model card: <https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice>
- VoiceDesign model card: <https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign>
- License: <https://github.com/QwenLM/Qwen3-TTS/blob/main/LICENSE>

### Fallback: Chatterbox Multilingual V3

Use Chatterbox Multilingual V3 when its smaller model footprint, broader language coverage, or built-in PerTh audio watermarking is a better operational fit. It remains a fallback rather than the default, and every output must pass the same editorial and listening review.

Official sources:

- Repository: <https://github.com/resemble-ai/chatterbox>
- Model family and usage: <https://github.com/resemble-ai/chatterbox#chatterbox-tts>
- License: <https://github.com/resemble-ai/chatterbox/blob/master/LICENSE>

## Publish-time production workflow

Narration is generated offline at publish time, not synchronously during a reader's page request.

1. Freeze the approved article copy and calculate a content hash from the narration-ready text, voice-profile version, model version, and synthesis settings.
2. Split the article at editorial section and natural paragraph boundaries. Preserve headings as chapter markers, and never send the entire article as one unchecked generation.
3. Generate each section with one locked voice profile and a documented delivery preset for pace, tone, pronunciation, pauses, and emphasis.
4. Review every section while following the final transcript. Regenerate passages with mispronunciations, omissions, repetitions, invented words, unnatural pauses, tonal drift, or inconsistent speaker identity.
5. Assemble only approved sections. Normalize loudness and peaks consistently across the complete article, remove accidental leading or trailing silence, and listen to the final joined master from beginning to end.
6. Encode a delivery MP3 and retain an archival lossless master. Serve the MP3 as a static asset through the article player rather than invoking the synthesis model in a live page request.
7. Cache the approved output under its content hash. A copy, voice, model, or settings change creates a new hash and requires regeneration and review; unchanged content reuses the existing approved asset.

## Reader experience and accessibility

Every narrated article must include:

- the complete readable article and an accurate synchronized or section-aligned transcript;
- semantic player controls that work with keyboard and assistive technology;
- play and pause, seek, elapsed and total time, playback-speed control, and clear focus states;
- chapter navigation for substantial posts;
- an accessible player label and a text alternative when audio cannot load;
- a visible disclosure such as `AI-narrated with editorial review` whenever synthesis is used.

Narration supplements the article. It never replaces the readable text.

## Consent and voice rights

kingXford & Co must never clone, imitate, or build a voice profile from a real person without that person's explicit written permission.

This applies equally to employees, contractors, clients, public figures, interview subjects, creators, and audio found online. Public availability is not consent. A short reference clip is not permission. Do not scrape a podcast, video, meeting, social post, or archival recording to create a voice.

Written authorization for any real-person voice profile must identify:

- the person granting permission and the recordings covered;
- the permitted products, channels, topics, languages, territories, and term;
- whether synthesis, editing, translation, and future reuse are allowed;
- compensation, review rights, renewal, withdrawal, and deletion procedures;
- who may access the source recordings, derived profile, and generated audio.

Store consent records with the voice-profile provenance. Restrict source audio and derived profiles to authorized operators, and remove or disable them when permission expires or is withdrawn. Synthetic narration must not be presented as an unscripted statement by the source speaker.

When no authorized real-person voice is available, use a licensed built-in voice or an original designed synthetic voice. If a genuinely human performance is required, commission a professional narrator instead of attempting an unauthorized clone.

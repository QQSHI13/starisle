/* @ts-self-types="./marz_wasm.d.ts" */

/**
 * Builds a search index in the browser.
 *
 * ```js
 * const b = new MarzBuilder("ja", "location");
 * b.field("title", 10.0);
 * b.field("text");
 * b.add({ location: "guide/intro", title: "入門", text: "…" });
 * const bytes = b.build();          // Uint8Array, ready to store or search
 * ```
 */
export class MarzBuilder {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MarzBuilderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_marzbuilder_free(ptr, 0);
    }
    /**
     * Stage a document for indexing.
     *
     * The reference field must be present and a string; searchable fields may
     * be absent, `null` or `undefined`. Adding the same reference twice
     * replaces the previous document (upsert). A negative `boost` is clamped
     * to `0.0` at declaration; only a non-finite boost throws.
     * @param {any} doc
     * @param {number | null} [boost]
     */
    add(doc, boost) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.marzbuilder_add(retptr, this.__wbg_ptr, addBorrowedObject(doc), !isLikeNone(boost), isLikeNone(boost) ? 0 : boost);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            heap[stack_pointer++] = undefined;
        }
    }
    /**
     * Stage every document in an iterable. Equivalent to `add` in a loop.
     *
     * Not atomic, for the same reason: if a later document throws, the earlier
     * ones stay staged. Call `clear()` if a half-filled builder is not wanted.
     * @param {any} docs
     * @param {number | null} [boost]
     */
    addMany(docs, boost) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.marzbuilder_addMany(retptr, this.__wbg_ptr, addBorrowedObject(docs), !isLikeNone(boost), isLikeNone(boost) ? 0 : boost);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            heap[stack_pointer++] = undefined;
        }
    }
    /**
     * Tokenize and score the staged documents, returning the binary index.
     *
     * Pass `positions = false` to drop highlighting and CJK phrase
     * verification, which is about a tenth of the bytes. This also disables
     * the CJK phrase ranking boost.
     *
     * The staged documents are kept, so building twice yields two equivalent
     * indexes rather than an index and an empty one. Building is not cheap, but
     * a `build()` that quietly emptied the builder would turn a stray second
     * call into a silently empty search index.
     * @param {boolean | null} [positions]
     * @returns {Uint8Array}
     */
    build(positions) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.marzbuilder_build(retptr, this.__wbg_ptr, isLikeNone(positions) ? 0xFFFFFF : positions ? 1 : 0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeObject(r2);
            }
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export4(r0, r1 * 1, 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Build and load in one step, skipping the serialize/parse round trip.
     *
     * For the client-side case this is the common path: the index is being
     * built to be searched now, not stored. Use `build()` when the bytes are
     * what is wanted, to cache in IndexedDB or hand to a worker.
     *
     * Unlike `build()`, this takes no `positions` flag: the in-memory index
     * always keeps positions (dropping them only shrinks the serialized
     * bytes), so there is nothing to opt out of here.
     * @returns {MarzIndex}
     */
    buildAndLoad() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.marzbuilder_buildAndLoad(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return MarzIndex.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Discard the staged documents, keeping the field configuration.
     */
    clear() {
        wasm.marzbuilder_clear(this.__wbg_ptr);
    }
    /**
     * Declare a searchable field. `boost` multiplies the score of matches in it.
     *
     * Fields must be declared before the documents that use them: `add` reads
     * only the fields declared when it is called. A negative `boost` is
     * clamped to `0.0` at declaration (it still matches, contributing no
     * score); only a non-finite boost throws.
     *
     * Surrounding whitespace is not part of a name: it is trimmed before
     * storing, so `field(" title ")` and `title:q` meet.
     * @param {string} name
     * @param {number | null} [boost]
     */
    field(name, boost) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.marzbuilder_field(retptr, this.__wbg_ptr, ptr0, len0, !isLikeNone(boost), isLikeNone(boost) ? 0 : boost);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * The declared field names, in declaration order.
     * @returns {string[]}
     */
    get fields() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.marzbuilder_fields(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayJsValueFromWasm0(r0, r1);
            wasm.__wbindgen_export4(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * The configured language code.
     * @returns {string}
     */
    get language() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.marzbuilder_language(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Create a builder for `language`, one of the codes `languages()` returns.
     *
     * `refField` names the property holding each document's identity and
     * defaults to `"id"`. `k1` and `b` are the BM25 tuning parameters; the
     * defaults are the conventional 1.2 and 0.75.
     * @param {string} language
     * @param {string | null} [ref_field]
     * @param {number | null} [k1]
     * @param {number | null} [b]
     */
    constructor(language, ref_field, k1, b) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(language, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            var ptr1 = isLikeNone(ref_field) ? 0 : passStringToWasm0(ref_field, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            var len1 = WASM_VECTOR_LEN;
            wasm.marzbuilder_new(retptr, ptr0, len0, ptr1, len1, !isLikeNone(k1), isLikeNone(k1) ? 0 : k1, !isLikeNone(b), isLikeNone(b) ? 0 : b);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            this.__wbg_ptr = r0;
            MarzBuilderFinalization.register(this, this.__wbg_ptr, this);
            return this;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * The configured reference field.
     * @returns {string}
     */
    get refField() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.marzbuilder_refField(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * How many documents are staged and ready to build.
     * @returns {number}
     */
    get staged() {
        const ret = wasm.marzbuilder_staged(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) MarzBuilder.prototype[Symbol.dispose] = MarzBuilder.prototype.free;

/**
 * A loaded Marz search index.
 *
 * Created with [`MarzIndex::load`]. Holds WebAssembly memory, so call `free()`
 * when done with it — or keep one for the lifetime of the page, which is the
 * normal shape for a search box.
 */
export class MarzIndex {
    static __wrap(ptr) {
        const obj = Object.create(MarzIndex.prototype);
        obj.__wbg_ptr = ptr;
        MarzIndexFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MarzIndexFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_marzindex_free(ptr, 0);
    }
    /**
     * The number of indexed documents.
     * @returns {number}
     */
    get documentCount() {
        const ret = wasm.marzindex_documentCount(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * The indexed field names.
     * @returns {string[]}
     */
    get fields() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.marzindex_fields(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayJsValueFromWasm0(r0, r1);
            wasm.__wbindgen_export4(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * The language code this index was built for.
     * @returns {string}
     */
    get language() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.marzindex_language(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Load an index from `to_binary()` output.
     *
     * The language is read from the index header, so it does not need to be
     * passed. Give `expectedLanguage` to assert what the bytes should be: a
     * build pipeline that ships the wrong file per locale otherwise produces a
     * search box that finds nothing, with no error anywhere to explain it.
     *
     * This materializes the postings rather than reading them in place, so it
     * costs time and memory proportional to the index — a 439 KB Japanese index
     * takes roughly 20 ms. Do it once and keep the result.
     * @param {Uint8Array} bytes
     * @param {string | null} [expected_language]
     * @returns {MarzIndex}
     */
    static load(bytes, expected_language) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            var ptr1 = isLikeNone(expected_language) ? 0 : passStringToWasm0(expected_language, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            var len1 = WASM_VECTOR_LEN;
            wasm.marzindex_load(retptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return MarzIndex.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Search the index, returning hits in descending score order.
     *
     * Query syntax: bare terms, `+required`, `-prohibited`, `field:term`,
     * `term*` wildcards, `term~N` fuzzy matching and `term^N` boosts.
     *
     * `limit` caps how many hits are converted to JavaScript objects. Scoring
     * happens for the whole corpus either way — the cap saves building position
     * maps for results past the first page, which is where the conversion cost
     * is. Must be a non-negative integer (`-0.0` behaves as `0`); absurdly
     * large values clamp to "no limit" rather than allocating.
     *
     * Throws an `Error` if the query cannot be parsed. The error carries
     * `query` plus `start` and `end` offsets into it, enough to underline the
     * fault in a search box. `start`/`end` are character offsets, not UTF-16
     * units — convert with `Array.from(query)` if highlighting astral text.
     * @param {string} query
     * @param {number | null} [limit]
     * @returns {SearchResult[]}
     */
    search(query, limit) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(query, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.marzindex_search(retptr, this.__wbg_ptr, ptr0, len0, !isLikeNone(limit), isLikeNone(limit) ? 0 : limit);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return takeObject(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * The number of distinct indexed terms. For CJK, bigrams rather than words.
     * @returns {number}
     */
    get termCount() {
        const ret = wasm.marzindex_termCount(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) MarzIndex.prototype[Symbol.dispose] = MarzIndex.prototype.free;

/**
 * Report the language an index was built for, without loading it.
 *
 * Reads the 64-byte header and stops. Useful for picking which index to fetch
 * when a site ships one per language, and for asserting that a build pipeline
 * produced what it meant to.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function indexLanguage(bytes) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.indexLanguage(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr2 = r0;
        var len2 = r1;
        if (r3) {
            ptr2 = 0; len2 = 0;
            throw takeObject(r2);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export4(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Language codes this build supports.
 * @returns {string[]}
 */
export function languages() {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.languages(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v1 = getArrayJsValueFromWasm0(r0, r1);
        wasm.__wbindgen_export4(r0, r1 * 4, 4);
        return v1;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Apply the same normalization the indexer applies before tokenizing.
 *
 * Folds full-width Latin to ASCII, composes half-width katakana, collapses
 * exotic spaces and lowercases. Exported because match positions are offsets
 * into this string rather than into the input: normalization is not
 * length-preserving — `ｶﾞ` is two code points and becomes one `ガ` — so text
 * containing half-width katakana shifts every offset after it.
 *
 * `language` selects the lowercasing rules and must be the index's language:
 * Turkish (`"tr"`) folds `I` to `ı`. Omit it for anything else.
 *
 * A caller highlighting a match must normalize the field text first. That is
 * what `highlight()` in the JavaScript wrapper does.
 * @param {string} text
 * @param {string | null} [language]
 * @returns {string}
 */
export function normalize(text, language) {
    let deferred3_0;
    let deferred3_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(text, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(language) ? 0 : passStringToWasm0(language, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        var len1 = WASM_VECTOR_LEN;
        wasm.normalize(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred3_0 = r0;
        deferred3_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export4(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Split `text` the way the index would, for inspecting how a query divides.
 *
 * The fastest way to understand a CJK result: `tokenize("検索エンジン", "ja")`
 * returns `["検索", "エン", "ンジ", "ジン"]` — overlapping bigrams, except that
 * no bigram crosses the Han/Katakana boundary, because `索エ` spans two words
 * and would only add noise.
 *
 * This is a pre-pipeline split: trimming, stop-word removal and stemming are
 * not applied, so the terms shown are not always the terms indexed.
 * @param {string} text
 * @param {string} language
 * @returns {string[]}
 */
export function tokenize(text, language) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(text, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(language, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        wasm.tokenize(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeObject(r2);
        }
        var v3 = getArrayJsValueFromWasm0(r0, r1);
        wasm.__wbindgen_export4(r0, r1 * 4, 4);
        return v3;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * The version of Marz this module was built from.
 * @returns {string}
 */
export function version() {
    let deferred1_0;
    let deferred1_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.version(retptr);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        deferred1_0 = r0;
        deferred1_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
    }
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_is_function_5e4570eb24ffa122: function(arg0) {
            const ret = typeof(getObject(arg0)) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_null_7d13f41e1a2d5140: function(arg0) {
            const ret = getObject(arg0) === null;
            return ret;
        },
        __wbg___wbindgen_is_object_a2790eb24c211ea0: function(arg0) {
            const val = getObject(arg0);
            const ret = typeof(val) === 'object' && val !== null;
            return ret;
        },
        __wbg___wbindgen_is_undefined_6cff064c44e0d823: function(arg0) {
            const ret = getObject(arg0) === undefined;
            return ret;
        },
        __wbg___wbindgen_string_get_d154f1e671052120: function(arg0, arg1) {
            const obj = getObject(arg1);
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_bb96b2010945f0bc: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_call_1c5886ab9c57d1c7: function() { return handleError(function (arg0, arg1) {
            const ret = getObject(arg0).call(getObject(arg1));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_done_669171204c3dcae2: function(arg0) {
            const ret = getObject(arg0).done;
            return ret;
        },
        __wbg_get_971a0c45d172643f: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(getObject(arg0), getObject(arg1));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_get_d173c0308df22d37: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(getObject(arg0), getObject(arg1));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_iterator_5cebbb86e33c6dd6: function() {
            const ret = Symbol.iterator;
            return addHeapObject(ret);
        },
        __wbg_new_116be93542d39019: function() {
            const ret = new Array();
            return addHeapObject(ret);
        },
        __wbg_new_358857d90afd5a2d: function(arg0, arg1) {
            const ret = new Error(getStringFromWasm0(arg0, arg1));
            return addHeapObject(ret);
        },
        __wbg_new_ebe3e0f6837f0879: function() {
            const ret = new Object();
            return addHeapObject(ret);
        },
        __wbg_next_42cf16ee0dafc9e2: function() { return handleError(function (arg0) {
            const ret = getObject(arg0).next();
            return addHeapObject(ret);
        }, arguments); },
        __wbg_next_8f26b64fa5e9f64b: function(arg0) {
            const ret = getObject(arg0).next;
            return addHeapObject(ret);
        },
        __wbg_push_adb0107829f02d75: function(arg0, arg1) {
            const ret = getObject(arg0).push(getObject(arg1));
            return ret;
        },
        __wbg_set_8155bb79a948541b: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = Reflect.set(getObject(arg0), getObject(arg1), getObject(arg2));
            return ret;
        }, arguments); },
        __wbg_stringify_f93a4ebae9231922: function() { return handleError(function (arg0) {
            const ret = JSON.stringify(getObject(arg0));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_value_1e2369fab29b420e: function(arg0) {
            const ret = getObject(arg0).value;
            return addHeapObject(ret);
        },
        __wbg_warn_0edbffae94c247f3: function(arg0, arg1) {
            console.warn(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_cast_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return addHeapObject(ret);
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return addHeapObject(ret);
        },
        __wbindgen_object_drop_ref: function(arg0) {
            takeObject(arg0);
        },
    };
    return {
        __proto__: null,
        "./marz_wasm_bg.js": import0,
    };
}

const MarzBuilderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_marzbuilder_free(ptr, 1));
const MarzIndexFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_marzindex_free(ptr, 1));

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

function addBorrowedObject(obj) {
    if (stack_pointer == 1) throw new Error('out of js stack');
    heap[--stack_pointer] = obj;
    return stack_pointer;
}

function dropObject(idx) {
    if (idx < 1028) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(takeObject(mem.getUint32(i, true)));
    }
    return result;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getObject(idx) { return heap[idx]; }

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        wasm.__wbindgen_export3(addHeapObject(e));
    }
}

let heap = new Array(1024).fill(undefined);
heap.push(undefined, null, true, false);

let heap_next = heap.length;

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let stack_pointer = 1024;

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('marz_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };

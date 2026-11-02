// Decoder constraints mirror the existing reader limits. Readers still reject
// whitespace-only text and malformed replies; no generated content is repaired.
export const boundedText=max=>({type:'string',minLength:1,maxLength:max});
export const boundedBilingual=max=>({type:'object',properties:{en:boundedText(max),zh:boundedText(max)},required:['en','zh'],additionalProperties:false});

// Shared chapter normalization utility for client and server

export const normalizeChapterName = (name) => {
    if (!name) return "";
    const normalized = name
        .toLowerCase()
        .replace(/&/g, ' and ') // replace & with 'and'
        .replace(/[^a-z0-9\s]/g, ' ') // replace special characters with spaces
        .split(/\s+/)
        .map(word => {
            // Singularize words ending in 's' (length > 3, e.g. haloalkanes -> haloalkane)
            if (word.length > 3 && word.endsWith('s')) {
                return word.slice(0, -1);
            }
            return word;
        })
        .filter(Boolean)
        .join(' ');

    const CHAPTER_SYNONYMS = {
        "atomic structure": "structure of atom",
        "structure of atoms": "structure of atom",
        "structure of atom": "structure of atom",
        "periodic table": "classification of elements and periodicity in properties",
        "periodicity in properties": "classification of elements and periodicity in properties",
        "periodicity in propertie": "classification of elements and periodicity in properties",
        "periodic classification": "classification of elements and periodicity in properties",
        "states of matter": "states of matter",
        "chemical bonding": "chemical bonding and molecular structure",
        "bonding": "chemical bonding and molecular structure",
        "thermodynamics": "chemical thermodynamics",
        "equilibrium": "equilibrium",
        "redox": "redox reactions",
        "solutions": "solutions",
        "electrochemistry": "electrochemistry",
        "kinetics": "chemical kinetics",
        "surface chemistry": "surface chemistry",
        "coordination": "coordination compounds",
        "haloalkanes": "haloalkanes and haloarenes",
        "haloarenes": "haloalkanes and haloarenes",
        "alcohol": "alcohols phenols and ethers",
        "phenol": "alcohols phenols and ethers",
        "ether": "alcohols phenols and ethers",
        "carbonyl": "aldehydes ketones and carboxylic acids",
        "aldehyde": "aldehydes ketones and carboxylic acids",
        "ketone": "aldehydes ketones and carboxylic acids",
        "carboxylic acid": "aldehydes ketones and carboxylic acids",
        "amines": "amines",
        "biomolecules": "biomolecules",
        "polymers": "polymers",
        "chemistry in everyday life": "chemistry in everyday life",
        "goc": "organic chemistry some basic principles and techniques",
        "general organic chemistry": "organic chemistry some basic principles and techniques",
        "organic chemistry basic principles": "organic chemistry some basic principles and techniques"
    };

    return CHAPTER_SYNONYMS[normalized] || normalized;
};

export const ABILITIES = {
  attack: [
    { type: 'hole', icon: '🪙', name: 'سرقة', desc: 'اسرق نقاط السؤال من لاعب إذا أجاب صح' },
    { type: 'freeze', icon: '❄️', name: 'تجميد', desc: 'جمِّد أحد المنافسين وأجبره على كسر الجليد' },
    { type: 'cut', icon: '✂️', name: 'قطع', desc: 'امنع لاعب من الإجابة السؤال القادم' },
    { type: 'blur', icon: '🌀', name: 'إرباك', desc: 'اخلط ترتيب خيارات لاعب في السؤال الحالي' },
  ],
  defense: [
    { type: 'reverse', icon: '🔄', name: 'عكس', desc: 'يرجع أي هجوم لصاحبه تلقائياً' },
    { type: 'immunity', icon: '🛡️', name: 'حصانة', desc: 'حماية كاملة من أي هجوم لسؤال' },
    { type: 'retry', icon: '↩️', name: 'إعادة', desc: 'لو غلطت تقدر تجاوب مرة ثانية' },
    { type: 'ghost', icon: '👻', name: 'تخفي', desc: 'اختفِ من قائمة الأهداف للسؤال القادم' },
  ],
  general: [
    { type: 'revival', icon: '✨', name: 'إنعاش', desc: 'استرجع ستريك خسرته عند الخطأ' },
    { type: 'doubleRisk', icon: '×2', name: 'مضاعف خطر', desc: 'صح=دبل النقاط، غلط=خسارة' },
    { type: 'hint', icon: '💡', name: 'تلميح', desc: 'اكشف تلميحاً للسؤال' },
    { type: 'spy', icon: '🔍', name: 'تجسس', desc: 'اعرف إجابة لاعب معين فور ما يجاوب' },
  ],
};

export const ABILITY_CAT_MAP = {
  hole: 'attack', freeze: 'attack', cut: 'attack', blur: 'attack',
  reverse: 'defense', immunity: 'defense', retry: 'defense', ghost: 'defense',
  doubleRisk: 'general', hint: 'general', revival: 'general', spy: 'general',
};

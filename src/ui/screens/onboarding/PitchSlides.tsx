import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

type SlideIndex = 0 | 1 | 2;

interface SlideContent {
  title: string;
  body: string;
}

const SLIDES: readonly [SlideContent, SlideContent, SlideContent] = [
  {
    title: 'Turn your life into an RPG',
    body: 'Every workout, every page, every conversation — they all count toward leveling up.',
  },
  {
    title: 'AI parses what you did. You just type.',
    body: 'No menus, no checklists. Tell us what you did in plain words and the AI fills in the rest.',
  },
  {
    title: 'Six attributes. One you. Level up.',
    body: 'STR, DEX, CON, INT, WIS, CHA. Real-world activities map to attributes you actually care about.',
  },
];

/**
 * Three-slide pitch carousel. Local-state-only — slide index is held in
 * `useState` and advanced by the "Next" button. "Skip" jumps straight to
 * character creation; the AI confirmation screen is only shown when the user
 * walks through all three slides.
 */
export function PitchSlides() {
  const router = useRouter();
  const [slide, setSlide] = useState<SlideIndex>(0);

  const handleNext = () => {
    if (slide < 2) {
      setSlide((slide + 1) as SlideIndex);
    } else {
      router.push('/onboarding/ai-confirm');
    }
  };

  const handleSkip = () => {
    router.push('/onboarding/creation');
  };

  const current = SLIDES[slide];

  return (
    <View testID="pitch-slides" className="flex-1 bg-bg px-6 pt-16">
      <View className="flex-row justify-end">
        <TouchableOpacity
          testID="pitch-skip"
          accessibilityRole="button"
          accessibilityLabel="Skip pitch"
          onPress={handleSkip}
        >
          <Text className="font-manrope text-text-mute" style={{ fontSize: 14 }}>
            Skip
          </Text>
        </TouchableOpacity>
      </View>

      <View className="mt-16 flex-1">
        <Text
          testID={`pitch-title-${slide}`}
          className="font-manrope-bold text-text"
          style={{ fontSize: 28, lineHeight: 34 }}
        >
          {current.title}
        </Text>
        <Text
          testID={`pitch-body-${slide}`}
          className="mt-4 font-manrope text-text-mute"
          style={{ fontSize: 16, lineHeight: 22 }}
        >
          {current.body}
        </Text>
      </View>

      <View className="mb-12">
        <View className="mb-6 flex-row items-center justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              testID={`pitch-dot-${i}`}
              accessibilityLabel={
                i === slide ? `Slide ${i + 1} of 3, current` : `Slide ${i + 1} of 3`
              }
              className="h-2 w-2 rounded-full"
              style={
                i === slide
                  ? { backgroundColor: '#E6EDF3' }
                  : { borderWidth: 1, borderColor: '#7D8590' }
              }
            />
          ))}
        </View>

        <TouchableOpacity
          testID="pitch-next"
          accessibilityRole="button"
          accessibilityLabel={slide < 2 ? 'Next slide' : 'Continue'}
          onPress={handleNext}
          className="rounded-2xl bg-accent py-4"
        >
          <Text className="text-center font-manrope-bold text-bg" style={{ fontSize: 16 }}>
            {slide < 2 ? 'Next' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

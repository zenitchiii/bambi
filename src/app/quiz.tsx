import ScreenContainer from "@/components/ScreenContainer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Check, Plus, RotateCcw, Trash2, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const QUIZ_KEY = "quizQuestions";

type Question = { id: string; question: string; answer: string };

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function QuizScreen() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [questionDraft, setQuestionDraft] = useState("");
  const [answerDraft, setAnswerDraft] = useState("");

  const [quizOrder, setQuizOrder] = useState<Question[] | null>(null);
  const [quizIndex, setQuizIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState({ right: 0, wrong: 0 });

  useEffect(() => {
    AsyncStorage.getItem(QUIZ_KEY).then(
      (saved) => saved && setQuestions(JSON.parse(saved)),
    );
  }, []);

  const saveQuestions = async (updated: Question[]) => {
    setQuestions(updated);
    await AsyncStorage.setItem(QUIZ_KEY, JSON.stringify(updated));
  };

  const addQuestion = () => {
    if (!questionDraft.trim() || !answerDraft.trim()) return;
    const newQ: Question = {
      id: `${Date.now()}`,
      question: questionDraft,
      answer: answerDraft,
    };
    saveQuestions([newQ, ...questions]);
    setQuestionDraft("");
    setAnswerDraft("");
    setAddModalVisible(false);
  };

  const removeQuestion = (id: string) => {
    Alert.alert("Remove this question?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => saveQuestions(questions.filter((q) => q.id !== id)),
      },
    ]);
  };

  const startQuiz = () => {
    setQuizOrder(shuffle(questions));
    setQuizIndex(0);
    setRevealed(false);
    setScore({ right: 0, wrong: 0 });
  };

  const answerCurrent = (correct: boolean) => {
    setScore((s) =>
      correct ? { ...s, right: s.right + 1 } : { ...s, wrong: s.wrong + 1 },
    );
    if (quizOrder && quizIndex + 1 < quizOrder.length) {
      setQuizIndex(quizIndex + 1);
      setRevealed(false);
    } else {
      setQuizIndex(quizIndex + 1); // pushes past the end to show the results screen
    }
  };

  const exitQuiz = () => setQuizOrder(null);

  // ---------- Quiz in progress or results ----------
  if (quizOrder) {
    const isDone = quizIndex >= quizOrder.length;
    if (isDone) {
      return (
        <ScreenContainer
          contentContainerStyle={{ gap: 16, alignItems: "center" }}
        >
          <Text style={styles.title}>Quiz complete! 🎉</Text>
          <Text style={styles.scoreText}>
            {score.right} / {quizOrder.length} correct
          </Text>
          <Pressable style={styles.primaryButton} onPress={startQuiz}>
            <RotateCcw color="#fff" size={16} />
            <Text style={styles.primaryButtonText}>Play again</Text>
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={exitQuiz}>
            <Text style={styles.cancelText}>Back to questions</Text>
          </Pressable>
        </ScreenContainer>
      );
    }

    const current = quizOrder[quizIndex];
    return (
      <ScreenContainer contentContainerStyle={{ gap: 16 }}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>
            Question {quizIndex + 1}/{quizOrder.length}
          </Text>
          <Pressable onPress={exitQuiz}>
            <X color="#e75480" size={22} />
          </Pressable>
        </View>

        <View style={styles.quizCard}>
          <Text style={styles.quizQuestion}>{current.question}</Text>
          {revealed && <Text style={styles.quizAnswer}>{current.answer}</Text>}
        </View>

        {!revealed ? (
          <Pressable
            style={styles.primaryButton}
            onPress={() => setRevealed(true)}
          >
            <Text style={styles.primaryButtonText}>Reveal answer</Text>
          </Pressable>
        ) : (
          <View style={styles.answerRow}>
            <Pressable
              style={[styles.answerButton, { backgroundColor: "#fdeaea" }]}
              onPress={() => answerCurrent(false)}
            >
              <Text style={[styles.answerButtonText, { color: "#d9534f" }]}>
                Got it wrong
              </Text>
            </Pressable>
            <Pressable
              style={[styles.answerButton, { backgroundColor: "#eafaf0" }]}
              onPress={() => answerCurrent(true)}
            >
              <Text style={[styles.answerButtonText, { color: "#3aa17e" }]}>
                Got it right
              </Text>
            </Pressable>
          </View>
        )}
      </ScreenContainer>
    );
  }

  // ---------- Question list / management ----------
  return (
    <ScreenContainer contentContainerStyle={{ gap: 16 }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Couples Quiz</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => setAddModalVisible(true)}
        >
          <Plus color="#fff" size={20} />
        </Pressable>
      </View>

      {questions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No questions yet</Text>
          <Text style={styles.emptyHint}>
            Add a few fun questions about each other to quiz on later
          </Text>
        </View>
      ) : (
        <>
          <Pressable style={styles.primaryButton} onPress={startQuiz}>
            <Text style={styles.primaryButtonText}>
              Start quiz ({questions.length} question
              {questions.length === 1 ? "" : "s"})
            </Text>
          </Pressable>
          {questions.map((q) => (
            <View key={q.id} style={styles.questionCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.questionText}>{q.question}</Text>
                <Text style={styles.answerPreview}>{q.answer}</Text>
              </View>
              <Pressable onPress={() => removeQuestion(q.id)}>
                <Trash2 color="#d9534f" size={18} />
              </Pressable>
            </View>
          ))}
        </>
      )}

      <Modal
        visible={addModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setAddModalVisible(false)}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>New question</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Where was our first date?"
              value={questionDraft}
              onChangeText={setQuestionDraft}
            />
            <TextInput
              style={styles.input}
              placeholder="Answer"
              value={answerDraft}
              onChangeText={setAnswerDraft}
            />
            <Pressable style={styles.primaryButton} onPress={addQuestion}>
              <Check color="#fff" size={16} />
              <Text style={styles.primaryButtonText}>Add</Text>
            </Pressable>
            <Pressable
              style={styles.cancelButton}
              onPress={() => setAddModalVisible(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 22, fontWeight: "700" },
  addButton: {
    backgroundColor: "#e75480",
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 6 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#999" },
  emptyHint: { fontSize: 13, color: "#bbb", textAlign: "center" },
  primaryButton: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#e75480",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  cancelButton: { padding: 14, alignItems: "center" },
  cancelText: { color: "#999" },
  questionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff5f7",
    borderRadius: 12,
    padding: 14,
  },
  questionText: { fontWeight: "600" },
  answerPreview: { fontSize: 12, color: "#999", marginTop: 2 },
  quizCard: {
    backgroundColor: "#fff5f7",
    borderRadius: 16,
    padding: 24,
    gap: 16,
    minHeight: 160,
    justifyContent: "center",
  },
  quizQuestion: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  quizAnswer: {
    fontSize: 16,
    color: "#e75480",
    fontWeight: "600",
    textAlign: "center",
  },
  answerRow: { flexDirection: "row", gap: 12 },
  answerButton: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  answerButtonText: { fontWeight: "700" },
  scoreText: { fontSize: 20, fontWeight: "700", color: "#e75480" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  sheet: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    gap: 12,
    width: "100%",
    maxWidth: 400,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 12 },
});

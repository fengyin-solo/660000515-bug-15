import React, { useState, useEffect } from 'react';
import { createRoom } from '../services/interviewRoomService';
import { getProblems } from '../services/problemService';
import type { InterviewRoom, CreateRoomRequest, CreateRoomResponse, User, Problem } from '../types';
import { DIFFICULTY_TAGS, getDifficultyTag } from '../types';
import { useInterviewStore } from '../store/interview';
import { useToastStore } from '../store/toast';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (room: InterviewRoom) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { currentUser, setMyRooms, myRooms, setCurrentUser, problems, setProblems } = useInterviewStore();
  const { error: showError, success } = useToastStore();
  const [title, setTitle] = useState('');
  const [problemId, setProblemId] = useState('');
  const [interviewerName, setInterviewerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [problemsLoading, setProblemsLoading] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [problemSearch, setProblemSearch] = useState('');
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [showProblemList, setShowProblemList] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProblems();
    }
  }, [isOpen]);

  // 弹窗关闭时重置本次选择，避免下次打开残留输入、筛选与错误状态
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    const problem = problems.find(p => p.id === problemId);
    setSelectedProblem(problem || null);
  }, [problemId, problems]);

  const loadProblems = async () => {
    setProblemsLoading(true);
    try {
      const data = await getProblems();
      setProblems(data);
    } catch (err) {
      console.error('Failed to load problems:', err);
      showError('加载题目列表失败，请稍后重试');
    } finally {
      setProblemsLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setProblemId('');
    setInterviewerName('');
    setLoading(false);
    setError('');
    setDifficultyFilter('all');
    setProblemSearch('');
    setSelectedProblem(null);
    setShowProblemList(false);
  };

  const trimmedTitle = title.trim();
  const trimmedInterviewerName = interviewerName.trim();

  // problemId 有值但已不在最新题目列表中（题目已被删除），视为失效
  const selectedProblemInvalid = !!problemId && !selectedProblem;

  const filteredProblems = problems.filter(p => {
    const matchesDifficulty = difficultyFilter === 'all' || p.difficulty === difficultyFilter;
    const matchesSearch = !problemSearch ||
      p.title.toLowerCase().includes(problemSearch.toLowerCase()) ||
      p.tags.some(t => t.toLowerCase().includes(problemSearch.toLowerCase()));
    return matchesDifficulty && matchesSearch;
  });

  const handleSelectProblem = (problem: Problem) => {
    setProblemId(problem.id);
    setShowProblemList(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 纯空格输入按未填写处理
    if (!trimmedTitle || !trimmedInterviewerName) {
      setError('请填写所有必填字段（不能仅为空格）');
      return;
    }
    if (!problemId) {
      setError('请选择一道面试题目');
      return;
    }
    if (selectedProblemInvalid) {
      setError('所选题目已被删除，请重新选择一道有效题目');
      setShowProblemList(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      // 提交内容去掉首尾空格，保留中间内容
      const requestData: CreateRoomRequest = {
        title: trimmedTitle,
        problemId,
        interviewerId: currentUser?.id || 'interviewer-001',
        interviewerName: trimmedInterviewerName,
      };
      const result: CreateRoomResponse = await createRoom(requestData);
      const user: User = {
        id: result.participant.userId,
        name: result.participant.userName,
        email: '',
        role: result.participant.userRole,
        createdAt: new Date().toISOString(),
      };
      setCurrentUser(user);
      setMyRooms([result.room, ...myRooms]);
      success(`面试房间「${trimmedTitle}」创建成功！房间码：${result.room.roomCode}`);
      onSuccess(result.room);
      // 成功后清理本次选择（onClose 触发的 effect 也会重置，这里先清保证导航时序）
      resetForm();
      onClose();
    } catch (err) {
      // 失败时保留用户已填写的有效内容，仅提示错误，允许直接重试或修改后重试
      const errorMessage = err instanceof Error ? err.message : '创建房间失败';
      setError(errorMessage);
      showError(errorMessage);
      // 后端判定题目失效（如提交瞬间被他人删除）：刷新列表，让失效题目标识出现以便重选
      const status = (err as { status?: number })?.status;
      if (status === 400 && /题目/.test(errorMessage)) {
        try {
          const data = await getProblems();
          setProblems(data);
        } catch {
          // 刷新失败不影响已展示的错误信息
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '4px',
    border: '1px solid #555',
    background: '#2d2d2d',
    color: '#fff',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1e1e1e', borderRadius: '8px', width: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid #333' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#fff', margin: 0, fontSize: '20px' }}>创建面试房间</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', color: '#ccc', marginBottom: '6px', fontSize: '14px' }}>房间标题 *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="请输入房间标题，如：前端开发工程师一面"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#ccc', marginBottom: '6px', fontSize: '14px' }}>面试官姓名 *</label>
              <input
                type="text"
                value={interviewerName}
                onChange={e => setInterviewerName(e.target.value)}
                placeholder="请输入面试官姓名"
                style={inputStyle}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ color: '#ccc', fontSize: '14px' }}>选择面试题目 *</label>
                <span style={{ color: '#666', fontSize: '12px' }}>
                  {problems.length} 道题目可用
                </span>
              </div>

              <div
                onClick={() => setShowProblemList(!showProblemList)}
                style={{
                  ...inputStyle,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  minHeight: '44px',
                  borderColor: selectedProblemInvalid ? '#f44336' : inputStyle.border,
                  background: selectedProblemInvalid ? 'rgba(244, 67, 54, 0.06)' : inputStyle.background,
                }}
              >
                {selectedProblem ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: '#fff' }}>{selectedProblem.title}</span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      background: getDifficultyTag(selectedProblem.difficulty).bgColor,
                      color: getDifficultyTag(selectedProblem.difficulty).color,
                    }}>
                      {getDifficultyTag(selectedProblem.difficulty).label}
                    </span>
                  </div>
                ) : selectedProblemInvalid ? (
                  <span style={{ color: '#f44336' }}>⚠️ 原选题目已被删除，请重新选择</span>
                ) : (
                  <span style={{ color: '#666' }}>点击选择题目</span>
                )}
                <span style={{ color: '#666' }}>▼</span>
              </div>

              {showProblemList && (
                <div style={{
                  marginTop: '8px',
                  background: '#252525',
                  border: '1px solid #444',
                  borderRadius: '6px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                }}>
                  <div style={{ padding: '12px', borderBottom: '1px solid #333' }}>
                    <input
                      type="text"
                      value={problemSearch}
                      onChange={e => setProblemSearch(e.target.value)}
                      placeholder="搜索题目..."
                      style={{ ...inputStyle, marginBottom: '10px' }}
                      onClick={e => e.stopPropagation()}
                    />
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDifficultyFilter('all'); }}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          border: `1px solid ${difficultyFilter === 'all' ? '#667eea' : '#444'}`,
                          background: difficultyFilter === 'all' ? 'rgba(102, 126, 234, 0.15)' : 'transparent',
                          color: difficultyFilter === 'all' ? '#667eea' : '#888',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        全部
                      </button>
                      {DIFFICULTY_TAGS.map(tag => (
                        <button
                          key={tag.value}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDifficultyFilter(tag.value); }}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            border: `1px solid ${difficultyFilter === tag.value ? tag.color : '#444'}`,
                            background: difficultyFilter === tag.value ? tag.bgColor : 'transparent',
                            color: difficultyFilter === tag.value ? tag.color : '#888',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          {tag.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {problemsLoading ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#888' }}>加载中...</div>
                  ) : filteredProblems.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#888' }}>没有找到匹配的题目</div>
                  ) : (
                    <div>
                      {filteredProblems.map(problem => {
                        const diffTag = getDifficultyTag(problem.difficulty);
                        const isSelected = problemId === problem.id;
                        return (
                          <div
                            key={problem.id}
                            onClick={(e) => { e.stopPropagation(); handleSelectProblem(problem); }}
                            style={{
                              padding: '12px 16px',
                              borderBottom: '1px solid #333',
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.background = '#2a2a2a';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ color: isSelected ? '#667eea' : '#fff', fontWeight: isSelected ? 500 : 400 }}>
                                {problem.title}
                              </span>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                background: diffTag.bgColor,
                                color: diffTag.color,
                              }}>
                                {diffTag.label}
                              </span>
                            </div>
                            {problem.tags.length > 0 && (
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {problem.tags.slice(0, 3).map((tag, idx) => (
                                  <span key={idx} style={{ color: '#666', fontSize: '11px' }}>#{tag}</span>
                                ))}
                                {problem.tags.length > 3 && (
                                  <span style={{ color: '#666', fontSize: '11px' }}>+{problem.tags.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {selectedProblem ? (
                <div style={{
                  marginTop: '12px',
                  padding: '16px',
                  background: '#252525',
                  borderRadius: '6px',
                  border: '1px solid #333',
                }}>
                  <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>题目预览</div>
                  <p style={{ color: '#ccc', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
                    {selectedProblem.description.length > 200
                      ? selectedProblem.description.substring(0, 200) + '...'
                      : selectedProblem.description}
                  </p>
                  {selectedProblem.examples.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ color: '#888', fontSize: '12px', marginBottom: '6px' }}>示例 1</div>
                      <div style={{
                        background: '#1a1a1a',
                        padding: '10px',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        color: '#9cdcfe',
                      }}>
                        <div>输入: {selectedProblem.examples[0].input}</div>
                        <div>输出: {selectedProblem.examples[0].output}</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : selectedProblemInvalid ? (
                <div style={{
                  marginTop: '12px',
                  padding: '14px 16px',
                  background: 'rgba(244, 67, 54, 0.08)',
                  borderRadius: '6px',
                  border: '1px solid rgba(244, 67, 54, 0.4)',
                  color: '#f44336',
                  fontSize: '13px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <span>⚠️ 该题目已被删除或下架，无法用于创建房间，请重新选择题目</span>
                  <button
                    type="button"
                    onClick={() => { setProblemId(''); setShowProblemList(true); setError(''); }}
                    style={{
                      flexShrink: 0,
                      padding: '6px 14px',
                      borderRadius: '4px',
                      border: '1px solid rgba(244, 67, 54, 0.5)',
                      background: 'rgba(244, 67, 54, 0.15)',
                      color: '#f44336',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    重新选择
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {error && (
            <div style={{ margin: '0 24px 16px', color: '#f44336', fontSize: '14px', padding: '8px 12px', background: 'rgba(244,67,54,0.1)', borderRadius: '4px' }}>
              {error}
            </div>
          )}

          <div style={{ padding: '16px 24px', borderTop: '1px solid #333', display: 'flex', gap: '12px', justifyContent: 'flex-end', background: '#1a1a1a' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{ padding: '10px 24px', borderRadius: '4px', border: '1px solid #555', background: 'transparent', color: '#ccc', cursor: 'pointer', fontSize: '14px' }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || !trimmedTitle || !trimmedInterviewerName || !problemId || selectedProblemInvalid}
              style={{ padding: '10px 24px', borderRadius: '4px', border: 'none', background: '#4caf50', color: '#fff', cursor: (loading || !trimmedTitle || !trimmedInterviewerName || !problemId || selectedProblemInvalid) ? 'not-allowed' : 'pointer', fontSize: '14px', opacity: (loading || !trimmedTitle || !trimmedInterviewerName || !problemId || selectedProblemInvalid) ? 0.5 : 1 }}
            >
              {loading ? '创建中...' : '创建房间'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
// 실제 운영 환경에서는 npm install @supabase/supabase-js 후 아래와 같이 import 하셔도 됩니다.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  Plus, Clock, CheckCircle2, ShieldCheck, MapPin, Package, EyeOff, User, 
  Truck, ArrowLeft, ChevronRight, AlertCircle, LogOut, Lock, Loader2, ClipboardList, Minus,
  Users, KeyRound, Phone, Search, Trash2, Camera
} from 'lucide-react';

// ==========================================
// 1. Supabase 클라이언트 초기화 (최종 연동)
// ==========================================
const supabaseUrl = 'https://zvwxvutmcnvqgnfhuifv.supabase.co'; 
const supabaseKey = 'sb_publishable_ndM9CTO8kx1sSmdm_PSk0g_Uup0IYac'; 
const supabase = createClient(supabaseUrl, supabaseKey);

// 연락처 자동 하이픈 변환 유틸리티 함수
const formatPhoneNumber = (value) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, '');
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 8) {
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
  }
  return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 7)}-${phoneNumber.slice(7, 11)}`;
};

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState(null); // 'customer' | 'partner' | 'admin'
  const [view, setView] = useState('home');
  const [selectedReqId, setSelectedReqId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // 로그인한 사용자 정보 보관
  const [currentUser, setCurrentUser] = useState(null); 
  const [currentPartner, setCurrentPartner] = useState(null); 

  // 관리자 접속용
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const ADMIN_SECRET_ENCODED = "MjRnbyQk"; 

  // 파트너 & 관리자 탭 상태
  const [partnerTab, setPartnerTab] = useState('new'); 
  const [adminTab, setAdminTab] = useState('orders'); 

  // DB 상태
  const [requests, setRequests] = useState([]);
  const [partners, setPartners] = useState([]);
  const selectedReq = requests.find(r => r.id === selectedReqId);

  // ==========================================
  // 2. [READ] 데이터 불러오기
  // ==========================================
  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('requests')
        .select(`*, bids (*)`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('오더 로딩 오류:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPartners(data || []);
    } catch (error) {
      console.error('파트너 로딩 오류:', error.message);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchRequests();
      if (role === 'admin') fetchPartners();
    }
  }, [isLoggedIn, role]);

  const renderItemsText = (itemsObj) => {
    if (!itemsObj) return "선택된 큰 짐 없음";
    const entries = Object.entries(itemsObj).filter(([_, count]) => count > 0);
    if (entries.length === 0) return "선택된 큰 짐 없음";
    return entries.map(([name, count]) => `${name}(${count})`).join(', ');
  };

  const handleLogout = () => {
    setIsLoggedIn(false); setRole(null); setView('home');
    setSelectedReqId(null); setShowAdminLogin(false); setAdminCode('');
    setCurrentUser(null); setCurrentPartner(null);
  };

  const handleAdminAccess = () => {
    try {
      if (btoa(adminCode.trim()) === ADMIN_SECRET_ENCODED) {
        setRole('admin'); setIsLoggedIn(true); setShowAdminLogin(false); setAdminCode('');
        setAdminTab('orders');
      } else {
        alert("관리자 코드가 일치하지 않습니다."); setAdminCode(''); setShowAdminLogin(false);
      }
    } catch (e) { alert("오류 발생"); setAdminCode(''); }
  };

  // --- 전역 액션 핸들러 (낙찰, 마감, 삭제) ---
  const handleAcceptBid = async (reqId, partnerCode, partnerName, price) => {
    if(!window.confirm(`[${partnerName}] 업체의 견적(${price.toLocaleString()}원)으로 낙찰하시겠습니까?\n낙찰 후에는 번복할 수 없으며, 고객님의 연락처가 해당 업체에 공개됩니다.`)) return;
    try {
        const { error } = await supabase.from('requests')
            .update({ status: 'awarded', winner_code: partnerCode })
            .eq('id', reqId);
        if(error) throw error;
        alert("낙찰이 완료되었습니다! 업체에서 곧 연락을 드릴 예정입니다.");
        fetchRequests();
    } catch(error) {
        alert("낙찰 처리 중 오류 발생: " + error.message + "\n(Supabase에 winner_code 컬럼이 있는지 확인해주세요)");
    }
  };

  const handleForceClose = async (reqId) => {
    if(!window.confirm("정말 이 견적을 강제 마감하시겠습니까?")) return;
    try {
      const { error } = await supabase.from('requests').update({ status: 'closed' }).eq('id', reqId);
      if(error) throw error;
      alert("입찰 마감 처리 완료!");
      fetchRequests();
      if(view === 'detail') setView('home');
    } catch (error) { alert("오류 발생: " + error.message); }
  };

  const handleDeleteOrder = async (reqId) => {
      if(!window.confirm("이 오더를 완전히 삭제하시겠습니까?\n삭제 후에는 다시 복구할 수 없습니다.")) return;
      try {
          const { error } = await supabase.from('requests').delete().eq('id', reqId);
          if(error) throw error;
          alert("성공적으로 삭제되었습니다.");
          fetchRequests();
          if(view === 'detail') setView('home');
      } catch (error) { alert("삭제 중 오류 발생: " + error.message); }
  };


  // --- 공통: Header ---
  const Header = () => (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center">
          {isLoggedIn && view !== 'home' && (
            <button onClick={() => setView('home')} className="mr-3 p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors hidden sm:block">
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <div className="flex items-center cursor-pointer" onClick={() => setView('home')}>
            <Truck className="w-8 h-8 text-blue-600 mr-2" />
            <span className="text-xl font-black text-slate-800 tracking-tight">24GO</span>
          </div>
        </div>
        
        {isLoggedIn && (
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-full hidden sm:inline-block">
              {role === 'customer' && `${currentUser?.name} 고객님`}
              {role === 'partner' && `[${currentPartner?.name}] 사장님`}
              {role === 'admin' && '관리자 통제실'}
            </span>
            <button onClick={handleLogout} className="text-sm font-bold text-gray-500 hover:text-slate-800 flex items-center transition-colors">
              <LogOut className="w-4 h-4 mr-1.5" />
              로그아웃
            </button>
          </div>
        )}
      </div>
    </header>
  );

  // --- 공통: 리스트 카드 컴포넌트 ---
  const RequestCard = ({ req, onClick, viewer }) => (
    <div onClick={onClick} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col h-full relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="flex justify-between items-start mb-5">
        <div>
            {req.status === 'bidding' ? (
            <span className="inline-flex items-center bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-lg mb-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse"></span>입찰 진행 중
            </span>
            ) : req.status === 'awarded' ? (
            <span className="inline-flex items-center bg-pink-100 text-pink-700 text-xs font-bold px-3 py-1.5 rounded-lg mb-2">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5"/>낙찰 완료
            </span>
            ) : (
            <span className="inline-flex items-center bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-lg mb-2">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5"/>입찰 마감
            </span>
            )}
            <div className="text-sm font-medium text-slate-500 flex items-center mt-1">
                <Clock className="w-4 h-4 mr-1.5" />
                {req.move_date} {req.move_time?.split(' ')[0]}
            </div>
        </div>
        {viewer === 'admin' && <span className="text-red-500 font-bold text-xs bg-red-50 px-2 py-1 rounded-md">{req.customer_name}</span>}
      </div>
      
      <div className="bg-gray-50/50 rounded-xl p-4 mb-5 flex-grow border border-gray-100 group-hover:bg-blue-50/30 transition-colors">
        <div className="flex items-start">
            <div className="flex flex-col items-center mr-4 mt-1">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                <div className="w-0.5 h-8 bg-gray-300 my-1"></div>
                <div className="w-2.5 h-2.5 rounded-full border-2 border-red-500 bg-white"></div>
            </div>
            <div className="space-y-4 w-full overflow-hidden">
                <div>
                    <p className="text-xs text-slate-400 font-medium mb-0.5">출발</p>
                    <p className="text-sm font-bold text-slate-800 truncate">
                        {viewer === 'partner' ? req.from_address.split(' ').slice(0,2).join(' ') : req.from_address}
                    </p>
                </div>
                <div>
                    <p className="text-xs text-slate-400 font-medium mb-0.5">도착</p>
                    <p className="text-sm font-bold text-slate-800 truncate">
                        {viewer === 'partner' ? req.to_address.split(' ').slice(0,2).join(' ') : req.to_address}
                    </p>
                </div>
            </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-auto">
        <div className="text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg text-sm flex items-center max-w-[60%]">
          <Package className="w-4 h-4 mr-1.5 text-slate-500 flex-shrink-0" />
          <span className="truncate font-medium">{renderItemsText(req.items)}</span>
        </div>
        <div className="flex-shrink-0">
            {viewer === 'customer' && (
                <span className="text-blue-600 font-bold bg-blue-50 px-3 py-1.5 rounded-lg flex items-center text-sm">
                    견적 <span className="mx-1 text-lg leading-none">{req.bids?.length || 0}</span>건
                </span>
            )}
            {viewer === 'partner' && (
                <span className="text-slate-700 font-bold bg-white border border-slate-200 px-3 py-1.5 rounded-lg flex items-center text-sm shadow-sm">
                    <User className="w-4 h-4 mr-1.5 text-slate-400" />
                    참여 <span className="ml-1 text-blue-600">{req.bids?.length || 0}</span>
                </span>
            )}
            {viewer === 'admin' && (
                <span className="text-red-500 font-bold px-2 py-1 text-sm">총 {req.bids?.length || 0}건</span>
            )}
        </div>
      </div>

      {/* 관리자: 카드 내에서 직접 마감/삭제 (권한 통제 강화) */}
      {viewer === 'admin' && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
              {req.status === 'bidding' ? (
                  <button onClick={() => handleForceClose(req.id)} className="flex-1 bg-orange-50 text-orange-600 py-2 rounded-lg text-sm font-bold hover:bg-orange-100 transition-colors flex items-center justify-center">
                      <Lock className="w-3.5 h-3.5 mr-1" /> 강제마감
                  </button>
              ) : (
                  <div className="flex-1 bg-gray-50 text-gray-400 py-2 rounded-lg text-sm font-bold flex items-center justify-center cursor-not-allowed">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 마감됨
                  </div>
              )}
              <button onClick={() => handleDeleteOrder(req.id)} className="flex-1 bg-red-50 text-red-600 py-2 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> 삭제
              </button>
          </div>
      )}
    </div>
  );

  // --- 0. 로그인 화면 ---
  const LoginScreen = () => {
    const [authStep, setAuthStep] = useState('main'); 
    const [loginName, setLoginName] = useState('');
    const [loginPhone, setLoginPhone] = useState('');
    const [loginCode, setLoginCode] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleCustomerLogin = () => {
        if(!loginName || !loginPhone) return alert('이름과 연락처를 모두 입력해주세요.');
        setCurrentUser({ name: loginName, phone: loginPhone });
        setRole('customer');
        setIsLoggedIn(true);
    };

    const handlePartnerLogin = async () => {
        if(!loginCode) return alert('관리자에게 발급받은 파트너 코드를 입력해주세요.');
        
        setIsLoggingIn(true);
        try {
            const { data, error } = await supabase.from('partners').select('*').eq('partner_code', loginCode).single();
            if (error || !data) {
                alert('등록되지 않은 파트너 코드입니다.\n관리자에게 문의해주세요.');
            } else {
                setCurrentPartner({ code: data.partner_code, name: data.partner_name });
                setRole('partner');
                setIsLoggedIn(true);
            }
        } catch (err) {
            alert('인증 중 오류가 발생했습니다.');
        } finally {
            setIsLoggingIn(false);
        }
    };

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        <header className="bg-white border-b border-gray-100 h-16 flex items-center">
          <div className="max-w-7xl mx-auto px-6 w-full flex items-center">
            <Truck className="w-8 h-8 text-blue-600 mr-2" />
            <span className="text-xl font-black text-slate-800 tracking-tight">24GO</span>
          </div>
        </header>
        
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            {/* Left: Hero Section */}
            <div className="space-y-8 hidden md:block">
              <div className="inline-flex items-center space-x-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-bold">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
                <span>실시간 이사 견적 비교 플랫폼</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-black text-slate-900 leading-tight">
                이사 갈 땐,<br/><span className="text-blue-600">스마트하게 24GO</span>
              </h1>
              <p className="text-lg text-slate-600 max-w-lg leading-relaxed">
                복잡한 이사 견적, 이제 발품 팔지 마세요. 한 번의 간편한 요청으로 검증된 파트너들의 실시간 견적을 비교하고 선택하세요.
              </p>
            </div>

            {/* Right: Login Options & Auth Forms */}
            <div className="bg-white p-8 sm:p-10 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
              
              {authStep === 'main' && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <h2 className="text-2xl font-bold text-slate-800 mb-8">서비스 시작하기</h2>
                    
                    <button onClick={() => setAuthStep('customer')} className="w-full group bg-white border-2 border-gray-100 hover:border-blue-600 text-left p-6 rounded-2xl transition-all duration-300">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-5">
                        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <User className="w-7 h-7" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">고객으로 시작하기</h3>
                            <p className="text-sm text-slate-500 mt-1 font-medium">내 이사 조건을 올리고 견적을 받아봅니다.</p>
                        </div>
                        </div>
                        <ChevronRight className="text-gray-300 group-hover:text-blue-600 transition-colors w-6 h-6" />
                    </div>
                    </button>

                    <button onClick={() => setAuthStep('partner')} className="w-full group bg-white border-2 border-gray-100 hover:border-slate-800 text-left p-6 rounded-2xl transition-all duration-300">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-5">
                        <div className="w-14 h-14 bg-slate-50 text-slate-700 rounded-full flex items-center justify-center group-hover:bg-slate-800 group-hover:text-white transition-colors">
                            <Truck className="w-7 h-7" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">파트너로 시작하기</h3>
                            <p className="text-sm text-slate-500 mt-1 font-medium">사장님! 오더를 확인하고 입찰해보세요.</p>
                        </div>
                        </div>
                        <ChevronRight className="text-gray-300 group-hover:text-slate-800 transition-colors w-6 h-6" />
                    </div>
                    </button>

                    <div className="mt-10 pt-8 border-t border-gray-100">
                    {showAdminLogin ? (
                        <div className="flex items-center space-x-2">
                        <input type="password" placeholder="관리자 보안 코드 입력" value={adminCode} onChange={e => setAdminCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAdminAccess(); }} className="flex-1 p-3 border border-gray-200 rounded-xl outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all text-slate-800" autoFocus />
                        <button onClick={handleAdminAccess} className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold transition-colors">접속</button>
                        </div>
                    ) : (
                        <div className="text-center">
                        <button onClick={() => setShowAdminLogin(true)} className="text-xs text-gray-400 hover:text-gray-600 font-mono transition-colors tracking-widest">ADMIN PORTAL</button>
                        </div>
                    )}
                    </div>
                </div>
              )}

              {/* 고객 로그인 폼 */}
              {authStep === 'customer' && (
                <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                    <button onClick={() => setAuthStep('main')} className="flex items-center text-sm font-bold text-slate-500 hover:text-slate-900 mb-6 transition-colors">
                        <ArrowLeft className="w-4 h-4 mr-1" /> 이전으로
                    </button>
                    <div className="flex items-center space-x-3 mb-8">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><User className="w-6 h-6"/></div>
                        <h2 className="text-2xl font-bold text-slate-800">고객 인증</h2>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">이름</label>
                            <input type="text" placeholder="예: 홍길동" value={loginName} onChange={e=>setLoginName(e.target.value)} className="w-full p-4 border border-gray-300 rounded-xl outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">연락처</label>
                            <input type="tel" placeholder="예: 010-1234-5678" value={loginPhone} onChange={e=>setLoginPhone(formatPhoneNumber(e.target.value))} onKeyDown={e => { if (e.key === 'Enter') handleCustomerLogin(); }} className="w-full p-4 border border-gray-300 rounded-xl outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all" />
                        </div>
                        <button onClick={handleCustomerLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl mt-4 transition-colors">
                            내 견적 확인 및 새 견적 요청
                        </button>
                    </div>
                </div>
              )}

              {/* 파트너 로그인 폼 */}
              {authStep === 'partner' && (
                <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                    <button onClick={() => setAuthStep('main')} className="flex items-center text-sm font-bold text-slate-500 hover:text-slate-900 mb-6 transition-colors">
                        <ArrowLeft className="w-4 h-4 mr-1" /> 이전으로
                    </button>
                    <div className="flex items-center space-x-3 mb-8">
                        <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center"><Truck className="w-6 h-6"/></div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">파트너 인증</h2>
                            <p className="text-xs text-slate-500 font-medium">관리자에게 발급받은 코드로 접속하세요.</p>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">업체 고유 코드</label>
                            <input type="text" placeholder="발급받은 파트너 코드 입력" value={loginCode} onChange={e=>setLoginCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handlePartnerLogin(); }} className="w-full p-4 border border-gray-300 rounded-xl outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-all font-mono text-lg" />
                        </div>
                        <button onClick={handlePartnerLogin} disabled={isLoggingIn} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 rounded-xl mt-4 transition-colors flex justify-center items-center">
                            {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : "접속하기"}
                        </button>
                    </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- 1. 관리자 전용 파트너 등록 뷰 ---
  const AdminPartnerManager = () => {
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const generateCode = async () => {
        if(!newName || !newPhone) return alert("업체명과 연락처를 모두 입력해주세요.");
        setIsGenerating(true);

        try {
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            const newCode = `P${randomNum}`;
            
            const { error } = await supabase.from('partners').insert([{
                partner_code: newCode,
                partner_name: newName,
                phone: newPhone
            }]);

            if(error) throw error;

            await fetchPartners();
            setNewName('');
            setNewPhone('');
            alert(`[${newName}] 업체의 코드가 성공적으로 발급되었습니다!\n발급 코드: ${newCode}`);
        } catch (error) {
            alert("코드 발급 중 오류가 발생했습니다: " + error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDeletePartner = async (code, name) => {
        if (window.confirm(`[${name}] 파트너의 등록을 취소하고 삭제하시겠습니까?\n이후 해당 코드로 로그인이 불가합니다.`)) {
            try {
                const { error } = await supabase.from('partners').delete().eq('partner_code', code);
                if(error) throw error;
                await fetchPartners();
                alert('파트너 코드가 삭제되었습니다.');
            } catch(error) {
                alert('삭제 중 오류가 발생했습니다: ' + error.message);
            }
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in">
            <div className="p-6 sm:p-8 bg-slate-50 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center mb-6">
                    <KeyRound className="w-6 h-6 mr-2 text-blue-600"/> 파트너 업체 등록 및 코드 발급
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-2">등록할 업체명</label>
                        <input type="text" placeholder="예: OO익스프레스" value={newName} onChange={e=>setNewName(e.target.value)} className="w-full p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-2">업체 대표 연락처</label>
                        <input type="tel" placeholder="예: 010-1234-5678" value={newPhone} onChange={e=>setNewPhone(formatPhoneNumber(e.target.value))} className="w-full p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="md:col-span-1 flex items-end">
                        <button onClick={generateCode} disabled={isGenerating} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold h-[58px] rounded-xl transition-colors shadow-sm flex justify-center items-center">
                            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin"/> : "새 코드 발급"}
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-6 sm:p-8">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                    <Users className="w-5 h-5 mr-2 text-slate-500"/> 등록된 파트너 목록 ({partners.length}개)
                </h3>
                
                {partners.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-xl text-gray-500">등록된 파트너가 없습니다.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-100 border-b border-gray-200">
                                    <th className="p-4 font-bold text-slate-600 text-sm">업체 코드</th>
                                    <th className="p-4 font-bold text-slate-600 text-sm">업체명</th>
                                    <th className="p-4 font-bold text-slate-600 text-sm">연락처</th>
                                    <th className="p-4 font-bold text-slate-600 text-sm">등록일</th>
                                    <th className="p-4 font-bold text-slate-600 text-sm text-center">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {partners.map((p, idx) => (
                                    <tr key={idx} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                                        <td className="p-4">
                                            <span className="bg-blue-100 text-blue-700 font-mono font-bold px-3 py-1.5 rounded-lg border border-blue-200">{p.partner_code}</span>
                                        </td>
                                        <td className="p-4 font-bold text-slate-800">{p.name || p.partner_name}</td>
                                        <td className="p-4 text-slate-600">{p.phone}</td>
                                        <td className="p-4 text-sm text-slate-400">{new Date(p.created_at).toLocaleDateString()}</td>
                                        <td className="p-4 text-center">
                                            <button onClick={() => handleDeletePartner(p.partner_code, p.partner_name)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors inline-flex items-center text-xs font-bold">
                                                <Trash2 className="w-4 h-4 mr-1"/> 삭제
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
  };

  // --- 2. 고객: 조건 작성 폼 ---
  const CustomerCreateForm = () => {
    const timeOptions = ['오전 (08시~12시)', '오후 (12시~18시)', '저녁 (18시 이후)', '시간 협의'];
    const itemOptions = ['냉장고', 'TV', '세탁기', '에어컨', '침대', '소파', '식탁', '장롱'];
    
    const [formData, setFormData] = useState({
      fromRegion: '', fromDetail: '', toRegion: '', toDetail: '', date: '', time: timeOptions[0], rooms: 1, 
      items: itemOptions.reduce((acc, curr) => ({ ...acc, [curr]: 0 }), {}),
      extraItems: '', hasElevatorFrom: false, hasLadderFrom: false, hasElevatorTo: false, hasLadderTo: false, 
      agreeTerms1: false, agreeTerms2: false, mediaFiles: []
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [addressType, setAddressType] = useState(null);

    useEffect(() => {
      const scriptId = 'daum-postcode-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
        script.async = true;
        document.head.appendChild(script);
      }
    }, []);

    useEffect(() => {
      if (isAddressModalOpen && window.daum && window.daum.Postcode) {
        const container = document.getElementById('postcode-container');
        if (container) {
          new window.daum.Postcode({
            oncomplete: function(data) {
              let fullAddress = data.address;
              let extraAddress = '';
              
              if (data.addressType === 'R') {
                if (data.bname !== '') extraAddress += data.bname;
                if (data.buildingName !== '') extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
                fullAddress += (extraAddress !== '' ? ` (${extraAddress})` : '');
              }
              
              if (addressType === 'from') setFormData(prev => ({ ...prev, fromRegion: fullAddress }));
              else setFormData(prev => ({ ...prev, toRegion: fullAddress }));
              
              setIsAddressModalOpen(false);
            },
            width: '100%',
            height: '100%'
          }).embed(container);
        }
      }
    }, [isAddressModalOpen, addressType]);

    const handleSearchAddress = (type) => {
      if (!window.daum || !window.daum.Postcode) {
          return alert("주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      }
      setAddressType(type);
      setIsAddressModalOpen(true);
    };

    const updateItemCount = (item, delta) => setFormData(prev => ({ ...prev, items: { ...prev.items, [item]: Math.max(0, prev.items[item] + delta) } }));

    const handleSubmit = async () => {
      if(!formData.fromRegion || !formData.toRegion || !formData.date) {
        return alert("필수 정보를 모두 입력해주세요.");
      }
      if(!formData.agreeTerms1 || !formData.agreeTerms2) {
        return alert("필수 약관에 동의하셔야 합니다.");
      }

      setIsSubmitting(true);
      
      const fullFromAddress = `${formData.fromRegion} ${formData.fromDetail}`.trim();
      const fullToAddress = `${formData.toRegion} ${formData.toDetail}`.trim();
      
      // 파일명 추출하여 기타사항에 텍스트로 합침 (실제 Storage 연동 전 에러 방지용)
      const fileNames = formData.mediaFiles.length > 0 ? formData.mediaFiles.map(f => f.name).join(', ') : '';
      const finalExtraItems = fileNames ? `${formData.extraItems}\n\n[첨부된 파일: ${fileNames}]` : formData.extraItems;

      try {
        const { error } = await supabase.from('requests').insert([{
          customer_name: currentUser.name,
          phone: currentUser.phone,
          from_address: fullFromAddress,
          to_address: fullToAddress,
          move_date: formData.date,
          move_time: formData.time,
          rooms: formData.rooms,
          items: formData.items,
          extra_items: finalExtraItems,
          has_elevator_from: formData.hasElevatorFrom,
          has_ladder_from: formData.hasLadderFrom, // Supabase에 컬럼 필요
          has_elevator_to: formData.hasElevatorTo,
          has_ladder_to: formData.hasLadderTo, // Supabase에 컬럼 필요
          status: 'bidding'
        }]);

        if (error) throw error;
        
        alert("이사 요청이 성공적으로 등록되었습니다!");
        await fetchRequests();
        setView('home');
      } catch (error) {
        alert("등록 중 오류가 발생했습니다: " + error.message + "\n(Supabase에 has_ladder_from, has_ladder_to 컬럼이 추가되었는지 확인해주세요!)");
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 animate-in fade-in">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-900">새 이사 견적 요청</h2>
            <p className="text-slate-500 mt-2">정확한 정보를 입력할수록 더 정확한 견적을 받을 수 있습니다.</p>
          </div>
          <button onClick={() => setView('home')} className="flex items-center justify-center text-slate-600 hover:text-slate-900 bg-white border border-gray-200 px-5 py-2.5 rounded-xl transition-colors font-bold shadow-sm sm:hidden">
            <ArrowLeft className="w-5 h-5 mr-2" /> 목록으로
          </button>
        </div>
        
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 sm:p-10 space-y-12">
            
            <section>
                <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-gray-100">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><User className="w-5 h-5" /></div>
                    <h3 className="text-xl font-bold text-slate-800">1. 신청자 정보 (로그인 연동)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                    <div>
                        <label className="block text-sm font-bold text-slate-500 mb-2">이름</label>
                        <p className="text-lg font-bold text-slate-800">{currentUser.name}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-500 mb-2">연락처</label>
                        <p className="text-lg font-bold text-slate-800">{currentUser.phone}</p>
                    </div>
                </div>
            </section>

            <section>
                <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-gray-100">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><MapPin className="w-5 h-5" /></div>
                    <h3 className="text-xl font-bold text-slate-800">2. 이사 장소 및 일정</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100">
                        <label className="block text-sm font-bold text-slate-700 mb-2">출발지 <span className="text-red-500">*</span></label>
                        <div className="flex space-x-2 mb-2">
                            <input type="text" readOnly placeholder="주소 검색 버튼을 눌러주세요" value={formData.fromRegion} className="flex-1 p-4 rounded-xl border border-gray-200 bg-gray-100 text-slate-600 outline-none cursor-pointer" onClick={() => handleSearchAddress('from')} />
                            <button onClick={() => handleSearchAddress('from')} className="bg-slate-800 hover:bg-slate-900 text-white px-5 rounded-xl font-bold transition-colors whitespace-nowrap shadow-sm">주소 검색</button>
                        </div>
                        <input type="text" placeholder="상세 주소 (동/호수 등)" value={formData.fromDetail} onChange={e => setFormData({...formData, fromDetail: e.target.value})} className="w-full p-4 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none" />
                        
                        <div className="mt-4 flex flex-col space-y-2">
                            <label className="flex items-center cursor-pointer group w-fit">
                                <input type="checkbox" checked={formData.hasElevatorFrom} onChange={e => setFormData({...formData, hasElevatorFrom: e.target.checked})} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" />
                                <span className="ml-3 text-sm text-slate-600 group-hover:text-slate-900 font-bold">엘리베이터 사용 가능</span>
                            </label>
                            <label className="flex items-center cursor-pointer group w-fit">
                                <input type="checkbox" checked={formData.hasLadderFrom} onChange={e => setFormData({...formData, hasLadderFrom: e.target.checked})} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" />
                                <span className="ml-3 text-sm text-slate-600 group-hover:text-slate-900 font-bold">사다리차 사용 가능</span>
                            </label>
                        </div>
                    </div>
                    
                    <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100">
                        <label className="block text-sm font-bold text-slate-700 mb-2">도착지 <span className="text-red-500">*</span></label>
                        <div className="flex space-x-2 mb-2">
                            <input type="text" readOnly placeholder="주소 검색 버튼을 눌러주세요" value={formData.toRegion} className="flex-1 p-4 rounded-xl border border-gray-200 bg-gray-100 text-slate-600 outline-none cursor-pointer" onClick={() => handleSearchAddress('to')} />
                            <button onClick={() => handleSearchAddress('to')} className="bg-slate-800 hover:bg-slate-900 text-white px-5 rounded-xl font-bold transition-colors whitespace-nowrap shadow-sm">주소 검색</button>
                        </div>
                        <input type="text" placeholder="상세 주소 (동/호수 등)" value={formData.toDetail} onChange={e => setFormData({...formData, toDetail: e.target.value})} className="w-full p-4 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none" />
                        
                        <div className="mt-4 flex flex-col space-y-2">
                            <label className="flex items-center cursor-pointer group w-fit">
                                <input type="checkbox" checked={formData.hasElevatorTo} onChange={e => setFormData({...formData, hasElevatorTo: e.target.checked})} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" />
                                <span className="ml-3 text-sm text-slate-600 group-hover:text-slate-900 font-bold">엘리베이터 사용 가능</span>
                            </label>
                            <label className="flex items-center cursor-pointer group w-fit">
                                <input type="checkbox" checked={formData.hasLadderTo} onChange={e => setFormData({...formData, hasLadderTo: e.target.checked})} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" />
                                <span className="ml-3 text-sm text-slate-600 group-hover:text-slate-900 font-bold">사다리차 사용 가능</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">이사 희망일 <span className="text-red-500">*</span></label>
                        <input type="date" className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none" onChange={e => setFormData({...formData, date: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">시간대</label>
                        <select className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none" onChange={e => setFormData({...formData, time: e.target.value})}>
                            {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>
            </section>

            <section>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-4 border-b border-gray-100 gap-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><Package className="w-5 h-5" /></div>
                        <h3 className="text-xl font-bold text-slate-800">3. 짐 정보</h3>
                    </div>
                    <div className="flex items-center space-x-3 bg-gray-50 p-2 rounded-xl border border-gray-200">
                        <label className="text-sm font-bold text-slate-700 ml-2">현재 방 갯수</label>
                        <select className="p-2 border border-gray-300 rounded-lg text-sm bg-white font-bold outline-none focus:ring-2 focus:ring-blue-500" onChange={e => setFormData({...formData, rooms: Number(e.target.value)})}>
                            {[1,2,3,4,5].map(n => <option key={n} value={n}>방 {n}개</option>)}
                        </select>
                    </div>
                </div>
                
                <div className="bg-blue-50/30 p-6 rounded-2xl border border-blue-100 mb-6">
                    <p className="text-sm text-blue-800 mb-5 font-bold flex items-center">
                        <AlertCircle className="w-5 h-5 mr-2 text-blue-600"/> 보유하고 계신 주요 큰 짐의 수량을 선택해주세요.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {itemOptions.map(item => (
                        <div key={item} className={`flex flex-col justify-between items-center p-4 border rounded-xl transition-all ${formData.items[item] > 0 ? 'border-blue-500 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                            <span className={`font-bold text-base mb-4 ${formData.items[item] > 0 ? 'text-blue-700' : 'text-slate-600'}`}>{item}</span>
                            <div className="flex items-center space-x-3 bg-gray-50 px-2 py-1.5 rounded-full border border-gray-200 w-full justify-between">
                                <button onClick={() => updateItemCount(item, -1)} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 bg-white border border-gray-200 hover:bg-gray-100 transition-colors"><Minus className="w-4 h-4"/></button>
                                <span className="w-6 text-center font-black text-slate-800">{formData.items[item]}</span>
                                <button onClick={() => updateItemCount(item, 1)} className="w-8 h-8 flex items-center justify-center rounded-full text-blue-600 bg-white border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"><Plus className="w-4 h-4"/></button>
                            </div>
                        </div>
                    ))}
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-bold text-slate-700 mb-2">기타 사항 (특수 화물, 잔짐 등)</label>
                    <textarea placeholder="피아노, 안마의자 등 특수 화물이 있거나 기타 요청사항을 상세히 적어주세요." className="w-full p-5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white h-32 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none leading-relaxed" onChange={e => setFormData({...formData, extraItems: e.target.value})} />
                </div>

                {/* 파일 업로드 폼 추가 */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center">
                        <Camera className="w-4 h-4 mr-1.5 text-slate-500"/> 현장 사진/영상 첨부 (선택)
                    </label>
                    <input 
                        type="file" 
                        multiple 
                        accept="image/*,video/*"
                        onChange={(e) => setFormData({...formData, mediaFiles: Array.from(e.target.files)})}
                        className="w-full p-3 rounded-xl border border-gray-200 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer text-sm text-slate-600 transition-all" 
                    />
                    <p className="text-xs text-slate-400 mt-3 font-medium">* 견적 산출에 도움이 되는 짐 사진이나 집 내부 환경을 첨부해주세요.</p>
                </div>
            </section>

            <section className="bg-slate-50 p-6 sm:p-8 rounded-2xl border border-slate-200 space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center mb-5 text-lg"><ShieldCheck className="w-6 h-6 mr-2 text-slate-600"/> 필수 약관 동의</h3>
                <div className="space-y-4">
                    <label className="flex items-center cursor-pointer group bg-white p-4 rounded-xl border border-gray-200">
                        <input type="checkbox" checked={formData.agreeTerms1} onChange={e => setFormData({...formData, agreeTerms1: e.target.checked})} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" />
                        <span className="ml-3 text-sm text-slate-700 group-hover:text-slate-900 font-bold">[필수] 개인정보 수집 및 이용 동의</span>
                    </label>
                    <label className="flex items-center cursor-pointer group bg-white p-4 rounded-xl border border-gray-200">
                        <input type="checkbox" checked={formData.agreeTerms2} onChange={e => setFormData({...formData, agreeTerms2: e.target.checked})} className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" />
                        <span className="ml-3 text-sm text-slate-700 group-hover:text-slate-900 font-bold">[필수] 파트너 업체에 정보 제공 동의</span>
                    </label>
                </div>
            </section>

            <div className="pt-4">
                <button onClick={handleSubmit} disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xl font-black py-6 rounded-2xl flex justify-center items-center transition-all shadow-lg shadow-blue-600/20 active:scale-[0.99]">
                    {isSubmitting ? <Loader2 className="w-7 h-7 animate-spin" /> : "견적 요청 완료하기"}
                </button>
            </div>

          </div>
        </div>

        {isAddressModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col h-[70vh] sm:h-[80vh] animate-in zoom-in-95 duration-200 border border-gray-100">
                    <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-slate-50">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center">
                            <Search className="w-5 h-5 mr-2 text-blue-600"/> 주소 검색
                        </h3>
                        <button onClick={() => setIsAddressModalOpen(false)} className="text-slate-400 hover:text-slate-800 font-bold bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-sm transition-colors shadow-sm">
                            닫기 ✕
                        </button>
                    </div>
                    <div id="postcode-container" className="flex-1 w-full h-full bg-white relative"></div>
                </div>
            </div>
        )}
      </div>
    );
  };

  // --- 3. 상세 뷰 (고객/관리자/파트너) ---
  const DetailView = () => {
    if (!selectedReq) return null;

    // 파트너 본인이 낙찰받은 오더인지 판별
    const isPartnerWinner = role === 'partner' && selectedReq.status === 'awarded' && selectedReq.winner_code === currentPartner?.code;

    // 상세 주소 블라인드 로직 (고객/관리자이거나, 낙찰받은 파트너면 블라인드 해제)
    const canSeeFullAddress = role === 'admin' || role === 'customer' || isPartnerWinner;
    const renderFromAddress = canSeeFullAddress ? selectedReq.from_address : selectedReq.from_address.split(' ').slice(0, 2).join(' ') + ' OOO';
    const renderToAddress = canSeeFullAddress ? selectedReq.to_address : selectedReq.to_address.split(' ').slice(0, 2).join(' ') + ' OOO';

    return (
      <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 animate-in fade-in">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h2 className="text-3xl font-black text-slate-900">
                    {role === 'admin' ? '요청 상세 현황 (관리자)' : '실시간 견적 확인'}
                </h2>
                <p className="text-slate-500 mt-2">
                    {role === 'customer' ? '입찰된 파트너들의 견적 현황을 확인하세요.' : '해당 오더의 상세 내용과 입찰 결과를 확인합니다.'}
                </p>
            </div>
            <button onClick={() => setView('home')} className="flex items-center justify-center text-slate-600 hover:text-slate-900 bg-white border border-gray-200 px-5 py-2.5 rounded-xl transition-colors font-bold shadow-sm sm:hidden">
                <ArrowLeft className="w-5 h-5 mr-2" /> 목록으로 돌아가기
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 sm:p-8">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center border-b border-gray-100 pb-4">
                        <ClipboardList className="w-5 h-5 mr-2 text-blue-600"/> 이사 상세 정보
                    </h3>
                    
                    {/* 정보 공개 영역 (관리자, 고객 본인, 혹은 낙찰받은 파트너) */}
                    {canSeeFullAddress && (
                        <div className={`${role === 'admin' ? 'bg-red-50 border-red-100' : isPartnerWinner ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-100'} p-5 rounded-2xl border mb-8 animate-in fade-in zoom-in-95`}>
                            {isPartnerWinner ? (
                                <>
                                    <h4 className="font-black text-green-800 flex items-center mb-3 text-lg">
                                        🎉 축하합니다! 낙찰된 오더입니다.
                                    </h4>
                                    <p className="text-sm text-green-700 mb-4 font-bold">고객님과 연락하여 이사 일정을 확정해주세요.</p>
                                </>
                            ) : (
                                <h4 className={`font-bold ${role === 'admin' ? 'text-red-700' : 'text-blue-800'} flex items-center mb-3`}>
                                    <User className="w-4 h-4 mr-1.5"/> 신청자 정보
                                </h4>
                            )}
                            
                            <div className={`space-y-2 bg-white p-4 rounded-xl border ${role === 'admin' ? 'border-red-100/50' : isPartnerWinner ? 'border-green-100/50 shadow-sm' : 'border-blue-100/50'}`}>
                                <p className="text-sm text-slate-800"><span className={`font-bold ${role === 'admin' ? 'text-red-900' : isPartnerWinner ? 'text-green-900' : 'text-blue-900'} mr-2 w-12 inline-block`}>이름</span> {selectedReq.customer_name}</p>
                                <p className="text-sm text-slate-800 font-mono"><span className={`font-bold ${role === 'admin' ? 'text-red-900' : isPartnerWinner ? 'text-green-900' : 'text-blue-900'} mr-2 w-12 inline-block font-sans`}>연락처</span> {selectedReq.phone}</p>
                            </div>
                        </div>
                    )}
                    
                    <div className="space-y-8">
                        <div className="relative pl-6">
                            <div className="absolute left-[9px] top-2 bottom-[-24px] w-0.5 bg-gray-200"></div>
                            <div className="absolute left-0 top-1.5 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white shadow-sm z-10">
                                <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                            </div>
                            <p className="text-xs text-blue-600 font-bold mb-1">출발지 {!canSeeFullAddress && '(동까지 표시)'}</p>
                            <p className={`font-bold text-slate-800 break-keep leading-relaxed ${!canSeeFullAddress ? 'text-lg' : 'text-sm'}`}>
                                {renderFromAddress}
                            </p>
                            <div className="flex space-x-2 mt-2">
                                <span className="inline-block text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                    엘리베이터: {selectedReq.has_elevator_from ? 'O' : 'X'}
                                </span>
                                <span className="inline-block text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                    사다리차: {selectedReq.has_ladder_from ? 'O' : 'X'}
                                </span>
                            </div>
                        </div>
                        <div className="relative pl-6">
                            <div className="absolute left-0 top-1.5 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center border-2 border-white shadow-sm z-10">
                                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            </div>
                            <p className="text-xs text-red-500 font-bold mb-1">도착지 {!canSeeFullAddress && '(동까지 표시)'}</p>
                            <p className={`font-bold text-slate-800 break-keep leading-relaxed ${!canSeeFullAddress ? 'text-lg' : 'text-sm'}`}>
                                {renderToAddress}
                            </p>
                            <div className="flex space-x-2 mt-2">
                                <span className="inline-block text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                    엘리베이터: {selectedReq.has_elevator_to ? 'O' : 'X'}
                                </span>
                                <span className="inline-block text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                    사다리차: {selectedReq.has_ladder_to ? 'O' : 'X'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100 space-y-5">
                        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <span className="text-sm font-bold text-slate-600">이사 일정</span>
                            <span className="text-sm font-bold text-slate-900">{selectedReq.move_date} <span className="text-slate-500 font-normal">({selectedReq.move_time})</span></span>
                        </div>
                        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <span className="text-sm font-bold text-slate-600">방 구조</span>
                            <span className="text-sm font-bold text-slate-900">방 {selectedReq.rooms}개</span>
                        </div>
                        <div className="pt-2">
                            <span className="block text-sm font-bold text-slate-700 mb-2">선택된 큰 짐</span>
                            <div className="bg-white p-4 rounded-xl text-sm font-bold text-blue-700 leading-relaxed border border-blue-100 shadow-sm">
                                {renderItemsText(selectedReq.items)}
                            </div>
                        </div>
                        {selectedReq.extra_items && (
                            <div className="pt-2">
                                <span className="block text-sm font-bold text-slate-700 mb-2">기타 요청사항</span>
                                <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-700 whitespace-pre-wrap border border-slate-200">
                                    {selectedReq.extra_items}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 sm:p-8 min-h-full flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 pb-4 border-b border-gray-100 gap-4">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center">
                            도착한 견적 <span className="ml-2 text-3xl font-black text-blue-600">{selectedReq.bids?.length || 0}</span><span className="text-base font-bold text-slate-500 ml-1">건</span>
                        </h3>
                        {selectedReq.status === 'bidding' ? (
                            <span className="inline-flex items-center text-sm font-bold text-blue-700 bg-blue-50 border border-blue-100 px-4 py-2 rounded-xl">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-2 animate-pulse"></span>실시간 업데이트 중
                            </span>
                        ) : selectedReq.status === 'awarded' ? (
                            <span className="inline-flex items-center text-sm font-bold text-pink-700 bg-pink-100 border border-pink-200 px-4 py-2 rounded-xl">
                                <CheckCircle2 className="w-4 h-4 mr-1.5"/> 낙찰 완료
                            </span>
                        ) : (
                            <span className="inline-flex items-center text-sm font-bold text-gray-600 bg-gray-100 border border-gray-200 px-4 py-2 rounded-xl">
                                <CheckCircle2 className="w-4 h-4 mr-1.5"/> 최종 마감됨
                            </span>
                        )}
                    </div>

                    {!selectedReq.bids || selectedReq.bids.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-300 flex-grow">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-5 border border-gray-100">
                                <Clock className="w-10 h-10 text-gray-300" />
                            </div>
                            <p className="text-xl font-bold text-slate-800 mb-2">견적을 기다리고 있습니다.</p>
                            <p className="text-sm text-slate-500 font-medium">파트너사에서 실시간으로 견적을 산출 중입니다. 잠시만 기다려주세요.</p>
                        </div>
                    ) : (
                        <div className="space-y-4 flex-grow">
                            {selectedReq.bids.sort((a,b)=>a.price - b.price).map((bid, i) => {
                                const isMyBid = role === 'partner' && bid.partner_code === currentPartner?.code;
                                const isThisBidWinner = selectedReq.status === 'awarded' && selectedReq.winner_code === bid.partner_code;

                                return (
                                <div key={bid.id} className={`p-6 sm:p-8 rounded-2xl border transition-all ${isThisBidWinner ? 'border-pink-500 bg-pink-50/30 shadow-md shadow-pink-500/10 scale-[1.02]' : i===0 && !isMyBid ? 'border-blue-500 bg-blue-50/30 shadow-md shadow-blue-500/10' : isMyBid ? 'border-slate-800 bg-slate-50 shadow-md' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                                        <div className="flex items-center space-x-5">
                                            <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 ${isThisBidWinner ? 'bg-pink-600 text-white border-pink-700 shadow-inner' : i===0 && !isMyBid ? 'bg-blue-600 text-white border-blue-700 shadow-inner' : isMyBid ? 'bg-slate-800 text-white border-slate-900' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                                <Truck className="w-7 h-7" />
                                            </div>
                                            <div>
                                                <div className="flex items-center space-x-3 mb-1.5">
                                                    <h4 className="font-bold text-slate-900 text-xl">{bid.partner_name}</h4>
                                                    {isThisBidWinner && <span className="bg-pink-600 text-white text-xs font-bold px-2.5 py-1 rounded-md shadow-sm">최종 낙찰업체</span>}
                                                    {i === 0 && !isThisBidWinner && <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-md shadow-sm">최저가 제안</span>}
                                                    {isMyBid && !isThisBidWinner && <span className="bg-slate-800 text-white text-xs font-bold px-2.5 py-1 rounded-md shadow-sm">내 견적</span>}
                                                </div>
                                                {bid.edit_count > 0 ? (
                                                    <span className="inline-flex items-center text-xs text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100"><AlertCircle className="w-3 h-3 mr-1"/> 단가 수정됨</span>
                                                ) : (
                                                    <span className="text-xs text-slate-400 font-medium">최초 제안 견적</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right bg-white p-5 rounded-2xl border border-gray-100 sm:border-none sm:bg-transparent sm:p-0">
                                            <p className="text-sm text-slate-500 font-bold mb-1">제안 금액</p>
                                            <p className={`text-3xl font-black tracking-tight ${isThisBidWinner ? 'text-pink-600' : i===0 && !isMyBid ? 'text-blue-600' : isMyBid ? 'text-slate-800' : 'text-slate-800'}`}>
                                                {bid.price.toLocaleString()}<span className="text-lg font-bold ml-1 text-slate-600">원</span>
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* 고객 권한: 입찰 중일 때 낙찰하기 버튼 표시 */}
                                    {role === 'customer' && selectedReq.status === 'bidding' && (
                                        <button onClick={() => handleAcceptBid(selectedReq.id, bid.partner_code, bid.partner_name, bid.price)} className="mt-6 w-full bg-blue-600 text-white text-lg font-bold py-4 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
                                            이 업체로 낙찰하기
                                        </button>
                                    )}
                                </div>
                            )})}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    );
  };

  // --- 4. 파트너: 입찰 폼 (웹 2단 구조) ---
  const PartnerBidForm = () => {
    if (!selectedReq) return null;
    
    const existingBid = selectedReq.bids?.find(b => b.partner_code === currentPartner.code);
    
    const [price, setPrice] = useState(existingBid ? existingBid.price.toString() : '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const submitBid = async () => {
      if(!price) return alert("제안 단가를 입력해주세요.");
      setIsSubmitting(true);

      try {
        if (!existingBid) {
            const { error } = await supabase.from('bids').insert([{
                request_id: selectedReq.id,
                partner_code: currentPartner.code,
                partner_name: currentPartner.name,
                price: Number(price),
                edit_count: 0
            }]);
            if(error) throw error;
            alert("성공적으로 입찰되었습니다!");
        } else {
            if (existingBid.edit_count >= 1) {
                alert("단가 수정은 1회만 가능합니다.");
                setIsSubmitting(false);
                return;
            }
            const { error } = await supabase.from('bids')
                .update({ price: Number(price), edit_count: existingBid.edit_count + 1 })
                .eq('id', existingBid.id);
            if(error) throw error;
            alert("견적이 성공적으로 수정되었습니다.");
        }
        await fetchRequests();
        setView('home');
      } catch (error) {
        alert("처리 중 오류 발생: " + error.message);
      } finally {
        setIsSubmitting(false);
      }
    };

    const hiddenFrom = selectedReq.from_address.split(' ').slice(0, 2).join(' ') + ' OOO';
    const hiddenTo = selectedReq.to_address.split(' ').slice(0, 2).join(' ') + ' OOO';

    return (
      <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 animate-in fade-in">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h2 className="text-3xl font-black text-slate-900">견적 제안 / 수정하기</h2>
                <p className="text-slate-500 mt-2">고객의 이사 조건을 확인하고 합리적인 견적을 제안하세요.</p>
            </div>
            <button onClick={() => setView('home')} className="flex items-center justify-center text-slate-600 hover:text-slate-900 bg-white border border-gray-200 px-5 py-2.5 rounded-xl transition-colors font-bold shadow-sm sm:hidden">
                <ArrowLeft className="w-5 h-5 mr-2" /> 목록으로 돌아가기
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center">
                        <ClipboardList className="w-5 h-5 mr-2 text-slate-500"/> 오더 상세 내용
                    </h3>
                    <span className="flex items-center text-orange-600 font-bold bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-lg text-xs">
                        <EyeOff className="w-4 h-4 mr-1.5" /> 상세 주소 블라인드 처리됨
                    </span>
                </div>

                <div className="space-y-8">
                    <div className="relative pl-6">
                        <div className="absolute left-[9px] top-2 bottom-[-24px] w-0.5 bg-gray-200"></div>
                        <div className="absolute left-0 top-1.5 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white shadow-sm z-10">
                            <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                        </div>
                        <p className="text-xs text-blue-600 font-bold mb-1">출발지 (동까지 표시)</p>
                        <p className="text-lg font-black text-slate-800 break-keep">{hiddenFrom}</p>
                        <div className="flex space-x-2 mt-2">
                            <span className="inline-block text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                엘리베이터: {selectedReq.has_elevator_from ? 'O' : 'X'}
                            </span>
                            <span className="inline-block text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                사다리차: {selectedReq.has_ladder_from ? 'O' : 'X'}
                            </span>
                        </div>
                    </div>
                    <div className="relative pl-6">
                        <div className="absolute left-0 top-1.5 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center border-2 border-white shadow-sm z-10">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        </div>
                        <p className="text-xs text-red-500 font-bold mb-1">도착지 (동까지 표시)</p>
                        <p className="text-lg font-black text-slate-800 break-keep">{hiddenTo}</p>
                        <div className="flex space-x-2 mt-2">
                            <span className="inline-block text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                엘리베이터: {selectedReq.has_elevator_to ? 'O' : 'X'}
                            </span>
                            <span className="inline-block text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                사다리차: {selectedReq.has_ladder_to ? 'O' : 'X'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 space-y-4">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <p className="text-sm font-bold text-slate-500 mb-1">이사 희망 일정</p>
                        <p className="font-bold text-slate-900 text-lg">{selectedReq.move_date} <span className="text-slate-600 text-base font-medium">({selectedReq.move_time})</span></p>
                    </div>
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <p className="text-sm font-bold text-blue-600 mb-2">보유 짐 현황 (방 {selectedReq.rooms}개)</p>
                        <p className="font-bold text-slate-800 leading-relaxed">{renderItemsText(selectedReq.items)}</p>
                    </div>
                    {selectedReq.extra_items && (
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <p className="text-sm font-bold text-slate-500 mb-2">기타 요청사항</p>
                            <p className="text-sm text-slate-800 whitespace-pre-wrap">{selectedReq.extra_items}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 sm:p-8 flex flex-col">
                <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
                    <Truck className="w-6 h-6 mr-2 text-blue-600"/> 견적 폼
                </h3>

                <div className="space-y-6 flex-1 flex flex-col">
                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 animate-in fade-in duration-500">
                        <div className="flex items-center space-x-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm">
                                <CheckCircle2 className="w-6 h-6"/>
                            </div>
                            <div>
                                <p className="font-black text-blue-900 text-xl">{currentPartner.name}</p>
                                <p className="text-xs text-blue-600 font-bold mt-0.5 font-mono">CODE: {currentPartner.code}</p>
                            </div>
                        </div>
                        
                        {existingBid && (
                            <div className="mt-5 pt-5 border-t border-blue-200/50">
                                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-blue-100">
                                    <span className="text-sm font-bold text-slate-500">제출한 입찰 단가</span>
                                    <span className="font-black text-blue-600">{existingBid.price.toLocaleString()}원</span>
                                </div>
                                <p className="text-sm font-bold mt-4 text-orange-600 flex items-center">
                                    <AlertCircle className="w-4 h-4 mr-1"/> 단가 수정 횟수: {existingBid.edit_count} / 1회 (최대 1회 수정 가능)
                                </p>
                            </div>
                        )}
                    </div>

                    {existingBid && existingBid.edit_count >= 1 ? (
                        <div className="bg-gray-100 text-gray-500 font-bold p-6 rounded-2xl border border-gray-200 text-center mt-auto">
                            이미 1회 수정을 완료하여 더 이상 단가를 변경할 수 없습니다.
                        </div>
                    ) : (
                        <div className="mt-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <label className="block text-sm font-bold text-slate-700 mb-2">제안 단가 입력 (원) <span className="text-red-500">*</span></label>
                            <div className="relative mb-6">
                                <input type="number" placeholder="예: 350000" value={price} onChange={e=>setPrice(e.target.value)} className="w-full p-5 pl-6 text-2xl font-black border-2 border-gray-300 rounded-2xl bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition-all" />
                                <span className="absolute right-6 top-1/2 transform -translate-y-1/2 text-xl font-bold text-slate-400">원</span>
                            </div>
                            <button onClick={submitBid} disabled={isSubmitting} className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xl font-black py-6 rounded-2xl flex justify-center items-center transition-all shadow-lg active:scale-[0.99]">
                                {isSubmitting ? <Loader2 className="w-7 h-7 animate-spin" /> : !existingBid ? "이 오더에 견적 제출하기" : "수정된 단가로 다시 제출하기"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    );
  };

  if (!isLoggedIn) return <LoginScreen />;

  // 사용자 권한별로 보여줄 리스트 필터링 로직
  const getFilteredRequests = () => {
    if (role === 'customer') {
        return requests.filter(r => r.customer_name === currentUser.name && r.phone === currentUser.phone);
    } else if (role === 'partner') {
        if (partnerTab === 'new') {
            return requests.filter(r => r.status === 'bidding' && !r.bids.some(b => b.partner_code === currentPartner.code));
        } else {
            return requests.filter(r => r.bids.some(b => b.partner_code === currentPartner.code));
        }
    }
    return requests; 
  };

  const filteredRequests = getFilteredRequests();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Header />
      
      <main className="flex-1">
        {isLoading && view === 'home' ? (
          <div className="flex justify-center items-center h-[calc(100vh-64px)]">
            <div className="flex flex-col items-center">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
                <p className="text-slate-500 font-bold">데이터를 불러오는 중입니다...</p>
            </div>
          </div>
        ) : (
          <>
            {view === 'home' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in">
                
                {role === 'admin' && (
                    <div className="flex space-x-2 mb-8 bg-gray-200/50 p-1.5 rounded-2xl w-fit">
                        <button onClick={() => setAdminTab('orders')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${adminTab === 'orders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            이사 오더 현황
                        </button>
                        <button onClick={() => setAdminTab('partners')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${adminTab === 'partners' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            파트너 관리 (코드발급)
                        </button>
                    </div>
                )}

                {role === 'partner' && (
                    <div className="flex space-x-2 mb-8 bg-slate-200/50 p-1.5 rounded-2xl w-fit">
                        <button onClick={() => setPartnerTab('new')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${partnerTab === 'new' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
                            전체 신규 오더
                        </button>
                        <button onClick={() => setPartnerTab('mybids')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${partnerTab === 'mybids' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
                            내 입찰 현황
                        </button>
                    </div>
                )}

                {role === 'admin' && adminTab === 'partners' ? (
                    <AdminPartnerManager />
                ) : (
                    <>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-6 border-b border-gray-200 pb-6">
                            <div>
                                <h1 className="text-3xl font-black text-slate-900">
                                    {role === 'customer' ? '내 견적 현황' : role === 'partner' ? (partnerTab === 'new' ? '입찰 가능한 신규 오더' : '내 입찰 현황 관리') : '전체 플랫폼 오더 통제실'}
                                </h1>
                                <p className="text-slate-500 mt-2 font-medium">
                                    {role === 'customer' ? '요청하신 이사 견적의 실시간 현황을 확인하고 비교하세요.' : role === 'partner' ? (partnerTab === 'new' ? '조건에 맞는 신규 오더를 확인하고 견적을 제안해보세요.' : '내가 제안한 견적 리스트와 결과를 확인하세요.') : '전체 플랫폼의 오더 현황을 실시간으로 모니터링합니다.'}
                                </p>
                            </div>
                            {role === 'customer' && (
                                <button onClick={()=>setView('create')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-xl font-bold flex items-center transition-all shadow-lg shadow-blue-600/20 w-full sm:w-auto justify-center active:scale-95">
                                    <Plus className="w-5 h-5 mr-2" /> 새 이사 견적 요청하기
                                </button>
                            )}
                        </div>

                        {filteredRequests.length === 0 ? (
                            <div className="text-center py-32 bg-white rounded-3xl border border-gray-200 shadow-sm animate-in zoom-in-95 duration-300">
                                {role === 'customer' ? (
                                    <>
                                        <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6"><Search className="w-10 h-10"/></div>
                                        <h3 className="text-2xl font-bold text-slate-800 mb-3">등록된 이사 견적이 없습니다.</h3>
                                        <p className="text-slate-500 mb-8">아직 이사 견적을 요청하지 않으셨습니다.<br/>상단의 버튼을 눌러 새 견적을 받아보세요!</p>
                                    </>
                                ) : (
                                    <>
                                        <Package className="w-20 h-20 text-gray-200 mx-auto mb-6" />
                                        <h3 className="text-2xl font-bold text-slate-700 mb-2">목록이 비어있습니다.</h3>
                                        <p className="text-slate-500">
                                            {role === 'partner' && partnerTab === 'new' ? '현재 입찰 가능한 신규 오더가 없습니다.' : role === 'partner' && partnerTab === 'mybids' ? '아직 견적을 제안한 오더가 없습니다.' : '현재 대기 중인 오더가 없습니다.'}
                                        </p>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredRequests.map(r => (
                                    <RequestCard 
                                        key={r.id} 
                                        req={r} 
                                        onClick={()=> {
                                            setSelectedReqId(r.id); 
                                            if(role === 'partner' && partnerTab === 'new') setView('bid');
                                            else setView('detail');
                                        }} 
                                        viewer={role} 
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
              </div>
            )}
            
            {view === 'create' && <CustomerCreateForm />}
            {view === 'detail' && <DetailView />}
            {view === 'bid' && <PartnerBidForm />}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
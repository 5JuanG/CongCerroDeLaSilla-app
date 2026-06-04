import React, { useState, useEffect } from 'react';

interface HomepageContent {
    id: string;
    imageUrl: string;
    title: string;
    phrase: string;
}

interface CarouselProps {
    slides: HomepageContent[];
}

const Carousel: React.FC<CarouselProps> = ({ slides }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const hasSlides = slides && slides.length > 0;

    useEffect(() => {
        if (!hasSlides) return;
        const timer = setTimeout(() => {
            setCurrentIndex(prev => (prev === slides.length - 1 ? 0 : prev + 1));
        }, 7000); // Change slide every 7 seconds
        return () => clearTimeout(timer);
    }, [currentIndex, slides, hasSlides]);

    if (!hasSlides) {
        // Fallback content if no slides are uploaded
        return (
            <div className="text-center p-4 sm:p-8 bg-white rounded-lg shadow-md max-w-4xl mx-auto">
                <h2 className="text-2xl sm:text-3xl font-bold text-blue-800">Congregacion Cerro de la Silla-Guadalupe, Bienvenido</h2>
                <p className="mt-4 text-md sm:text-lg text-gray-600">Aquí puede ver los programas de las reuniones, consultar territorios y más.</p>
                <p className="mt-2 text-gray-500">Para acceder a todas las funciones, por favor inicie sesión.</p>
            </div>
        );
    }

    const goToSlide = (index: number) => {
        setCurrentIndex(index);
    };

    const nextSlide = () => {
        setCurrentIndex(prev => (prev === slides.length - 1 ? 0 : prev + 1));
    }
    const prevSlide = () => {
        setCurrentIndex(prev => (prev === 0 ? slides.length - 1 : prev - 1));
    }

    return (
        <div className="w-full max-w-5xl mx-auto relative rounded-[2.5rem] shadow-2xl overflow-hidden group/carousel border border-white/20 glass">
            <div className="relative h-[300px] sm:h-[400px] md:h-[500px] w-full" >
                {slides.map((slide, index) => (
                    <div key={slide.id} className={`absolute inset-0 transition-all duration-1000 ease-in-out ${index === currentIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}>
                        <img src={slide.imageUrl} alt={slide.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-slate-800/80 flex flex-col justify-end p-8 sm:p-12 text-white">
                            <h3 className="text-3xl sm:text-5xl font-black drop-shadow-2xl mb-2 tracking-tight">{slide.title}</h3>
                            <p className="text-lg sm:text-xl text-gray-200 font-medium max-w-2xl drop-shadow-lg">{slide.phrase}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Navigation Buttons */}
            <button onClick={prevSlide} className="absolute top-1/2 left-4 transform -translate-y-1/2 bg-white/20 backdrop-blur-md p-4 rounded-2xl hover:bg-white/40 text-white transition-all opacity-0 group-hover/carousel:opacity-100 focus:outline-none z-10 border border-white/30">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={nextSlide} className="absolute top-1/2 right-4 transform -translate-y-1/2 bg-white/20 backdrop-blur-md p-4 rounded-2xl hover:bg-white/40 text-white transition-all opacity-0 group-hover/carousel:opacity-100 focus:outline-none z-10 border border-white/30">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>

            {/* Dot Indicators */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex space-x-3 z-10">
                {slides.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => goToSlide(index)}
                        className={`transition-all duration-300 rounded-full ${index === currentIndex ? 'w-8 h-3 bg-blue-500' : 'w-3 h-3 bg-white/40 hover:bg-white/60'}`}
                    ></button>
                ))}
            </div>
        </div>
    );
};
export default Carousel;

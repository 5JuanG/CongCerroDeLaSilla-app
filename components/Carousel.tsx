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
        <div className="w-full max-w-4xl mx-auto relative rounded-lg shadow-xl overflow-hidden">
            <div className="relative h-64 sm:h-80 md:h-96 w-full" >
                {slides.map((slide, index) => (
                    <div key={slide.id} className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}>
                        <img src={slide.imageUrl} alt={slide.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent flex flex-col justify-end p-6 text-white">
                            <h3 className="text-2xl font-bold drop-shadow-md">{slide.title}</h3>
                            <p className="mt-1 text-md drop-shadow-md">{slide.phrase}</p>
                        </div>
                    </div>
                ))}
            </div>
            
            {/* Navigation Buttons */}
            <button onClick={prevSlide} className="absolute top-1/2 left-2 transform -translate-y-1/2 bg-white/30 p-2 rounded-full hover:bg-white/50 text-white focus:outline-none z-10">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={nextSlide} className="absolute top-1/2 right-2 transform -translate-y-1/2 bg-white/30 p-2 rounded-full hover:bg-white/50 text-white focus:outline-none z-10">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            
            {/* Dot Indicators */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 z-10">
                {slides.map((_, index) => (
                    <button key={index} onClick={() => goToSlide(index)} className={`w-3 h-3 rounded-full transition-colors ${index === currentIndex ? 'bg-white' : 'bg-white/50 hover:bg-white/75'}`}></button>
                ))}
            </div>
        </div>
    );
};
export default Carousel;
